/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getDefaultProxySettings, type PipelinePolicy, type PipelineRequest, type PipelineResponse, type ProxySettings, type SendRequest } from '@azure/core-rest-pipeline';
import { HttpProxyAgent } from 'http-proxy-agent';
import { Agent as HttpsAgent } from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as vscode from 'vscode';

/** Proxy/TLS configuration resolved from VS Code's `http.*` settings. */
interface HttpProxyConfig {
    /** `false` when `http.proxySupport` is `off` (proxy handling disabled entirely). */
    proxySupportEnabled: boolean;
    proxyUrl?: string;
    /** `http.proxyStrictSSL`; defaults to `true`. */
    strictSSL: boolean;
    /** `http.noProxy` merged with the `NO_PROXY` env var. */
    noProxy: string[];
}

function getHttpProxyConfig(): HttpProxyConfig {
    const config = vscode.workspace.getConfiguration('http');
    // Default `'override'` matches VS Code; `'off'` disables proxy handling.
    const proxySupportEnabled = config.get<string>('proxySupport', 'override') !== 'off';
    const proxyUrl = config.get<string>('proxy')?.trim() || undefined;
    // Default `true`: only relax TLS validation when the user explicitly opts out.
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
 * Resolves the proxy URL, preferring VS Code's `http.proxy` and falling back to the standard proxy
 * env vars (case-insensitive). Protocol-aware: `http:` prefers `HTTP_PROXY`, `https:` prefers
 * `HTTPS_PROXY`, with `ALL_PROXY` as a cross-protocol fallback.
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
            // https-proxy-agent keeps `rejectUnauthorized` only in `connectOpts` (proxy-side TLS) and
            // resets `.options`, which is what Node merges into the destination handshake through the
            // CONNECT tunnel. Set it on `.options` so `proxyStrictSSL: false` reaches the server cert check.
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

/** Result of resolving a request URL against VS Code's proxy configuration. */
interface ResolvedProxy {
    url: URL;
    config: HttpProxyConfig;
    /** Proxy URL to use, or `undefined` when bypassed or no proxy is configured. */
    proxyUrl?: string;
}

/**
 * Shared resolution for a request URL. Returns `undefined` for invalid/non-http(s) URLs or when
 * `http.proxySupport` is `off`; otherwise resolves the proxy URL (honoring the `http.noProxy` bypass).
 */
function resolveProxyForRequest(requestUrl: string): ResolvedProxy | undefined {
    let url: URL;
    try {
        url = new URL(requestUrl);
    } catch {
        return undefined;
    }

    // Leave non-http(s) schemes (e.g. `ftp:`, `file:`) untouched.
    if (!isProxyableProtocol(url.protocol)) {
        return undefined;
    }

    const config = getHttpProxyConfig();
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
 * settings (falling back to the proxy env vars), or `undefined` when none applies. Lets extensions
 * apply the same proxy behavior to HTTP clients that bypass the Azure SDK pipeline (whose built-in
 * proxy policy only reads env vars and ignores VS Code's `http.*` settings).
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
 * Returns a {@link ProxySettings} object for the given request URL, or `undefined` when no proxy
 * applies. Intended for pipeline-based Azure SDK data-plane clients that accept `proxyOptions`
 * (e.g. Storage's `BlobServiceClient`/`ShareServiceClient`). Unlike {@link getProxyAgent}, it carries
 * no TLS override (`http.proxyStrictSSL: false`), since `ProxySettings` cannot express one.
 */
export function getProxySettings(requestUrl: string): ProxySettings | undefined {
    const proxyUrl = resolveProxyForRequest(requestUrl)?.proxyUrl;
    return proxyUrl ? getDefaultProxySettings(proxyUrl) : undefined;
}

/**
 * Pipeline policy that applies VS Code's proxy configuration to Azure SDK requests, running before
 * the SDK's built-in `proxyPolicy` (which only reads env vars and drops TLS settings). It either
 * injects `request.proxySettings` for a secure proxy (letting the built-in policy build/cache the
 * agent and honor `NODE_EXTRA_CA_CERTS`) or sets `request.agent` when a `http.proxyStrictSSL: false`
 * override is needed. Honors `http.noProxy` and `http.proxySupport: off`, and never overrides an
 * agent a caller set explicitly.
 */
export class ProxyAgentPolicy implements PipelinePolicy {
    public static readonly Name = 'azExtProxyAgentPolicy';
    public readonly name = ProxyAgentPolicy.Name;

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

        // A TLS override is needed (strictSSL: false), so own the agent, with or without a proxy.
        if (insecure) {
            request.agent = proxyUrl
                ? getProxyAgentForUrl(proxyUrl, isTls, /* rejectUnauthorized */ false)
                : getInsecureTlsAgent();
        }
    }
}
