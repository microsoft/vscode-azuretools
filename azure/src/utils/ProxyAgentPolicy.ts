/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getDefaultProxySettings, proxyPolicyName, type Pipeline, type PipelinePolicy, type PipelineRequest, type PipelineResponse, type ProxySettings, type SendRequest } from '@azure/core-rest-pipeline';
import { HttpProxyAgent } from 'http-proxy-agent';
import { Agent as HttpsAgent } from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as vscode from 'vscode';

/**
 * Proxy/TLS configuration resolved from VS Code's `http.*` settings.
 */
interface HttpProxyConfig {
    /**
     * `false` when `http.proxySupport` is `off`, meaning the user has opted out of proxy handling
     * and callers should apply no proxy or TLS override at all.
     */
    proxySupportEnabled: boolean;
    /** Value of the `http.proxy` setting, or `undefined` when unset. */
    proxyUrl?: string;
    /** Value of the `http.proxyStrictSSL` setting. Defaults to `true` (validate certificates). */
    strictSSL: boolean;
    /** Value of the `http.noProxy` setting merged with the `NO_PROXY` env var. */
    noProxy: string[];
}

/**
 * Reads proxy-related configuration from VS Code's `http` settings, merging `http.noProxy`
 * with the standard `NO_PROXY`/`no_proxy` environment variable.
 */
function getHttpProxyConfig(): HttpProxyConfig {
    const config = vscode.workspace.getConfiguration('http');
    // `http.proxySupport: 'off'` is the user's kill-switch for proxy support; callers short-circuit
    // to a no-op when it's set. Default is `'override'`, matching VS Code's own default behavior.
    const proxySupportEnabled = config.get<string>('proxySupport', 'override') !== 'off';
    const proxyUrl = config.get<string>('proxy')?.trim() || undefined;
    // Default to `true`: only relax TLS validation when the user has explicitly opted out.
    const strictSSL = config.get<boolean>('proxyStrictSSL', true);
    const noProxy = [...(config.get<string[]>('noProxy') ?? []), ...parseNoProxyEnv()]
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    return { proxySupportEnabled, proxyUrl, strictSSL, noProxy };
}

function parseNoProxyEnv(): string[] {
    const value = process.env.NO_PROXY ?? process.env.no_proxy;
    return value ? value.split(',') : [];
}

/**
 * Resolves the proxy URL to use, preferring VS Code's `http.proxy` setting and falling back to
 * the standard proxy environment variables (case-insensitive). The env-var fallback is
 * protocol-aware: `http:` requests prefer `HTTP_PROXY` and `https:` requests prefer `HTTPS_PROXY`,
 * matching common tooling (curl, etc.), with `ALL_PROXY` as a cross-protocol fallback.
 */
function resolveProxyUrl(config: HttpProxyConfig, isTls: boolean): string | undefined {
    if (config.proxyUrl) {
        return config.proxyUrl;
    }
    const protocolProxy = isTls
        ? (process.env.HTTPS_PROXY ?? process.env.https_proxy)
        : (process.env.HTTP_PROXY ?? process.env.http_proxy);
    return protocolProxy
        ?? process.env.ALL_PROXY ?? process.env.all_proxy
        ?? undefined;
}

/**
 * Returns `true` for the only schemes we proxy (`http:` and `https:`). Other schemes (e.g. `ftp:`,
 * `file:`) are left untouched.
 */
function isProxyableProtocol(protocol: string): boolean {
    return protocol === 'http:' || protocol === 'https:';
}

/**
 * Returns `true` when `host` matches an entry in `noProxyList` and should therefore bypass the
 * proxy. An entry that starts with `.` (or `*.`) matches the domain and any subdomain; otherwise
 * an exact host match is required.
 */
export function isHostBypassed(host: string, noProxyList: string[]): boolean {
    if (!host || noProxyList.length === 0) {
        return false;
    }
    const lowerHost = host.toLowerCase();
    for (const rawPattern of noProxyList) {
        // Treat "*", "*.foo.com" and ".foo.com" as domain suffixes.
        let pattern = rawPattern.toLowerCase();
        if (pattern === '*') {
            return true;
        }
        if (pattern.startsWith('*')) {
            pattern = pattern.slice(1);
        }
        if (pattern.startsWith('.')) {
            if (lowerHost === pattern.slice(1) || lowerHost.endsWith(pattern)) {
                return true;
            }
        } else if (lowerHost === pattern) {
            return true;
        }
    }
    return false;
}

// Caches so repeated requests reuse a single Agent (and its socket pool) per configuration.
const proxyAgentCache = new Map<string, HttpsProxyAgent<string> | HttpProxyAgent<string>>();
let insecureTlsAgent: HttpsAgent | undefined;

function getProxyAgentForUrl(proxyUrl: string, isTls: boolean, rejectUnauthorized: boolean): HttpsProxyAgent<string> | HttpProxyAgent<string> {
    const key = `${isTls ? 'https' : 'http'}|${proxyUrl}|${rejectUnauthorized}`;
    let agent = proxyAgentCache.get(key);
    if (!agent) {
        if (isTls) {
            const httpsAgent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized });
            // https-proxy-agent stores `rejectUnauthorized` only in `connectOpts` (the TLS handshake
            // to the proxy) and resets the agent's `.options` to `{ path: undefined }`. Node merges
            // the agent's `.options`, not `connectOpts`, into the destination TLS handshake inside the
            // CONNECT tunnel, so the flag would otherwise never reach the server certificate check.
            // Put it on `.options` so a `proxyStrictSSL: false` override actually relaxes destination
            // TLS (matching the no-proxy insecure agent).
            httpsAgent.options = { ...httpsAgent.options, rejectUnauthorized };
            agent = httpsAgent;
        } else {
            agent = new HttpProxyAgent(proxyUrl);
        }
        proxyAgentCache.set(key, agent);
    }
    return agent;
}

function getInsecureTlsAgent(): HttpsAgent {
    return (insecureTlsAgent ??= new HttpsAgent({ keepAlive: true, rejectUnauthorized: false }));
}

/**
 * Result of resolving a request URL against VS Code's proxy configuration, shared by
 * {@link getProxyAgent} and {@link getProxySettings}.
 */
interface ResolvedProxy {
    /** The parsed request URL. */
    url: URL;
    /** The resolved proxy configuration. */
    config: HttpProxyConfig;
    /** The proxy URL to use, or `undefined` when the host is bypassed or no proxy is configured. */
    proxyUrl?: string;
}

/**
 * Shared proxy resolution: parses `requestUrl`, ignores non-http(s) schemes, honors
 * `http.proxySupport: off` (returns `undefined`), applies the `http.noProxy` bypass, and resolves
 * the proxy URL from `http.proxy` with the standard proxy environment variables as a fallback.
 * Returns `undefined` when the URL is invalid, its scheme is not proxyable, or proxy support is off.
 */
function resolveProxyForRequest(requestUrl: string): ResolvedProxy | undefined {
    let url: URL;
    try {
        url = new URL(requestUrl);
    } catch {
        return undefined;
    }

    // Only http(s) requests are proxied; leave other schemes (e.g. `ftp:`, `file:`) untouched.
    if (!isProxyableProtocol(url.protocol)) {
        return undefined;
    }

    const config = getHttpProxyConfig();
    // `http.proxySupport: off` is an explicit opt-out: no proxy or TLS override applies.
    if (!config.proxySupportEnabled) {
        return undefined;
    }
    const isTls = url.protocol === 'https:';
    const bypassed = isHostBypassed(url.hostname, config.noProxy);
    const proxyUrl = bypassed ? undefined : resolveProxyUrl(config, isTls);
    return { url, config, proxyUrl };
}

/**
 * Returns an `http`/`https` `Agent` configured from VS Code's `http.proxy` / `http.proxyStrictSSL`
 * settings (falling back to the standard proxy environment variables) for the given request URL,
 * or `undefined` when no proxy or TLS override applies to it.
 *
 * Shared so extensions can apply the same proxy behavior to HTTP clients that don't go through the
 * Azure SDK pipeline. The Azure SDK's built-in proxy policy only reads proxy environment variables
 * and ignores VS Code's `http.*` settings, so this bridges that gap.
 */
export function getProxyAgent(requestUrl: string): HttpsAgent | HttpProxyAgent<string> | HttpsProxyAgent<string> | undefined {
    const resolved = resolveProxyForRequest(requestUrl);
    if (!resolved) {
        return undefined;
    }

    const { url, config, proxyUrl } = resolved;
    const isTls = url.protocol === 'https:';
    const insecure = isTls && config.strictSSL === false;

    if (proxyUrl) {
        // Own the agent when a TLS override is needed, since the SDK's proxy agent drops TLS options.
        return getProxyAgentForUrl(proxyUrl, isTls, /* rejectUnauthorized */ !insecure);
    }
    if (insecure) {
        return getInsecureTlsAgent();
    }
    return undefined;
}

/**
 * Returns a {@link ProxySettings} object (host/port/username/password) configured from VS Code's
 * `http.proxy` setting (falling back to the standard proxy environment variables) for the given
 * request URL, or `undefined` when no proxy applies (unset, `http.noProxy` bypass, or
 * `http.proxySupport: off`).
 *
 * Intended for pipeline-based Azure SDK data-plane clients that accept a `proxyOptions`/
 * `proxySettings` option (e.g. Storage's `BlobServiceClient`/`ShareServiceClient`) rather than a
 * raw `http.Agent`. Unlike {@link getProxyAgent}, this does not carry a TLS override
 * (`http.proxyStrictSSL: false`), since `ProxySettings` cannot express one.
 */
export function getProxySettings(requestUrl: string): ProxySettings | undefined {
    const proxyUrl = resolveProxyForRequest(requestUrl)?.proxyUrl;
    return proxyUrl ? getDefaultProxySettings(proxyUrl) : undefined;
}

/**
 * Pipeline policy that applies VS Code's proxy configuration to Azure SDK requests.
 *
 * The Azure SDK ships a built-in `proxyPolicy` that reads only proxy environment variables and
 * whose proxy agent discards TLS settings. This policy runs before it and:
 * - injects `request.proxySettings` from VS Code's `http.proxy` when only a secure proxy is needed
 *   (letting the built-in policy build and cache the agent, honoring `NODE_EXTRA_CA_CERTS`), or
 * - sets `request.agent` directly when a TLS override (`http.proxyStrictSSL: false`) is required,
 *   which the built-in policy respects by skipping requests that already have an agent.
 *
 * It also honors VS Code's `http.noProxy` (merged with `NO_PROXY`) and `http.proxySupport: off`
 * (which makes this policy a no-op), and never overrides an agent a caller set explicitly
 * (e.g. `sendRequestWithTimeout` with `rejectUnauthorized`).
 */
export class ProxyAgentPolicy implements PipelinePolicy {
    public static readonly Name = 'azExtProxyAgentPolicy';
    public readonly name = ProxyAgentPolicy.Name;

    /**
     * Adds the policy to `pipeline` (before the built-in proxy policy) unless it is already present.
     */
    public static addIfNeeded(pipeline: Pipeline): void {
        const alreadyAdded = pipeline.getOrderedPolicies().some((policy) => policy.name === ProxyAgentPolicy.Name);
        if (!alreadyAdded) {
            pipeline.addPolicy(new ProxyAgentPolicy(), { beforePolicies: [proxyPolicyName] });
        }
    }

    public async sendRequest(request: PipelineRequest, next: SendRequest): Promise<PipelineResponse> {
        // Respect an agent a caller set explicitly.
        if (!request.agent) {
            this.applyProxy(request);
        }
        return next(request);
    }

    private applyProxy(request: PipelineRequest): void {
        const resolved = resolveProxyForRequest(request.url);
        if (!resolved) {
            return;
        }
        const { url, config, proxyUrl } = resolved;
        const isTls = url.protocol === 'https:';
        const insecure = isTls && config.strictSSL === false;

        // Secure proxy from VS Code config: hand off to the built-in policy so it builds/caches the
        // agent and honors NODE_EXTRA_CA_CERTS. Env-var proxies are already handled by that policy.
        if (config.proxyUrl && proxyUrl && !insecure) {
            request.proxySettings ??= getDefaultProxySettings(config.proxyUrl);
            return;
        }

        // A TLS override is needed (strictSSL: false), so own the agent — with or without a proxy.
        if (insecure) {
            request.agent = proxyUrl
                ? getProxyAgentForUrl(proxyUrl, isTls, /* rejectUnauthorized */ false)
                : getInsecureTlsAgent();
        }
    }
}
