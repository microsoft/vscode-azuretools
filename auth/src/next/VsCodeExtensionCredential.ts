/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/core-auth';
import type { AzureLogger } from '@azure/logger';
import type * as vscode from 'vscode';
import type { VsCodeAuthentication } from './contracts/AzureAuthVsCode';
import { AzurePublicCloud, type EnvironmentLike } from './contracts/EnvironmentLike';
import { PublicAuthProviderId, SovereignAuthProviderId } from './configuredEnvironment';
import { getTokenExpiry } from './utils/getTokenExpiry';

/**
 * Options for constructing a {@link VsCodeExtensionCredential}.
 */
export interface VsCodeExtensionCredentialOptions {
    /**
     * (Required) The VS Code `authentication` namespace the credential will use to acquire tokens. Pass
     * `vscode.authentication` for easiest use; injecting it enables testing and dependency injection.
     */
    readonly authentication: VsCodeAuthentication;

    /**
     * (Optional) The tenant ID to authenticate to. Defaults to the tenant of the currently signed-in account.
     */
    readonly tenantId?: string;

    /**
     * (Optional) The Azure environment to authenticate to. Used to select the auth provider when
     * {@link authProviderId} is not specified. Defaults to {@link AzurePublicCloud}.
     */
    readonly environment?: EnvironmentLike;

    /**
     * (Optional) The VS Code authentication provider ID to use (e.g. `'microsoft'` or
     * `'microsoft-sovereign-cloud'`). When omitted, it is derived from {@link environment}.
     */
    readonly authProviderId?: string;

    /**
     * (Optional) A logger for auth lifecycle logging.
     */
    readonly logger?: AzureLogger;

    /**
     * (Optional) Options forwarded to {@link vscode.authentication.getSession} for non-challenge requests.
     * Controls session creation behavior (e.g. `silent`, `createIfNone`). Per-call options passed to
     * {@link VsCodeExtensionCredential.getToken} via {@link VsCodeGetTokenOptions} are merged on top of these.
     */
    readonly sessionOptions?: vscode.AuthenticationGetSessionOptions;
}

/**
 * Options for {@link VsCodeExtensionCredential.getToken}. Extends the standard {@link GetTokenOptions} with
 * VS Code authentication controls so callers (e.g. the subscription provider's sign-in and silent
 * session-probing paths) can drive the underlying `getSession` behavior through the credential rather than
 * talking to the VS Code authentication API directly.
 */
export interface VsCodeGetTokenOptions extends GetTokenOptions {
    /**
     * (Optional) Whether to create a new session (interactively) if none exists. Mutually exclusive with
     * {@link silent}.
     */
    createIfNone?: boolean;

    /**
     * (Optional) Whether to acquire the session silently (no prompt). Mutually exclusive with
     * {@link createIfNone}.
     */
    silent?: boolean;

    /**
     * (Optional) Whether to clear the user's session preference before acquiring the session.
     */
    clearSessionPreference?: boolean;

    /**
     * (Optional) The account to acquire the session for.
     */
    account?: vscode.AuthenticationSessionAccountInformation;

    /**
     * (Optional) A raw `WWW-Authenticate` header value describing a challenge (e.g. an MFA step-up) that
     * must be satisfied interactively. When set, the credential forces an interactive `getSession`. Use
     * {@link fallbackScopes} to supply scopes if VS Code cannot parse them from the header itself.
     */
    wwwAuthenticate?: string;

    /**
     * (Optional) Scopes to use when satisfying a {@link wwwAuthenticate} challenge if VS Code cannot parse
     * scopes from the header itself.
     */
    fallbackScopes?: string[];
}

/**
 * A {@link TokenCredential} implementation that defers to the VS Code `authentication` API to acquire
 * Microsoft/Azure access tokens. The VS Code `authentication` namespace is injected, so the credential can
 * be used with dependency injection and unit-tested with a mock.
 *
 * Selects the `microsoft` auth provider for the public Azure cloud and `microsoft-sovereign-cloud` for
 * sovereign/custom clouds based on {@link VsCodeExtensionCredentialOptions.environment} (or an explicit
 * {@link VsCodeExtensionCredentialOptions.authProviderId}).
 *
 * Conditional Access / MFA "claims" challenges are supported: when the Azure SDK's bearer token policy
 * surfaces a challenge via {@link GetTokenOptions.claims}, the credential performs an interactive
 * `getSession` so the user can satisfy the challenge.
 */
export class VsCodeExtensionCredential implements TokenCredential {
    public constructor(private readonly options: VsCodeExtensionCredentialOptions) { }

    /**
     * Acquire an access token for the given scopes via the VS Code authentication API. Returns `null` when
     * no session is available. Honors the SDK-requested scopes as-is (only a `VSCODE_TENANT:<id>` scope is
     * appended); it does not normalize or override them.
     */
    public async getToken(scopes: string | string[], options?: VsCodeGetTokenOptions): Promise<AccessToken | null> {
        const scopesArray = Array.isArray(scopes) ? [...scopes] : [scopes];

        const provider = this.getProviderId();

        const tenantId = options?.tenantId || this.options.tenantId;
        if (tenantId) {
            scopesArray.push(`VSCODE_TENANT:${tenantId}`);
        }

        // Merge per-call session controls on top of the constructor-provided sessionOptions.
        const sessionOptions: vscode.AuthenticationGetSessionOptions = { ...this.options.sessionOptions };
        if (options?.account !== undefined) {
            sessionOptions.account = options.account;
        }
        if (options?.clearSessionPreference !== undefined) {
            sessionOptions.clearSessionPreference = options.clearSessionPreference;
        }
        if (options?.createIfNone !== undefined) {
            sessionOptions.createIfNone = options.createIfNone;
        }
        if (options?.silent !== undefined) {
            sessionOptions.silent = options.silent;
        }

        // A challenge (a CAE/MFA "claims" challenge surfaced by the SDK, or a raw `WWW-Authenticate` header
        // forwarded for a non-CAE challenge) must be satisfiable interactively, so build a
        // WWW-Authenticate request and force an interactive sign-in.
        const wwwAuthenticate = options?.wwwAuthenticate ??
            (options?.claims ? `Bearer realm="", error="insufficient_claims", claims="${Buffer.from(options.claims).toString('base64')}"` : undefined);

        let session: vscode.AuthenticationSession | undefined;
        if (wwwAuthenticate) {
            this.options.logger?.info(`[auth] getToken challenge provider=${provider} tenant=${tenantId ?? '<default>'} scopes=${JSON.stringify(scopesArray)}`);
            const request: vscode.AuthenticationWwwAuthenticateRequest = {
                wwwAuthenticate,
                fallbackScopes: options?.fallbackScopes ? [...options.fallbackScopes] : scopesArray,
            };
            // `createIfNone` and `silent` are mutually exclusive, so drop any silent/non-interactive option
            // before forcing an interactive prompt to satisfy the challenge.
            const interactiveOptions: vscode.AuthenticationGetSessionOptions = { ...sessionOptions, createIfNone: true };
            delete interactiveOptions.silent;
            session = await this.options.authentication.getSession(provider, request, interactiveOptions);
        } else {
            this.options.logger?.info(`[auth] getToken start provider=${provider} tenant=${tenantId ?? '<default>'} scopes=${JSON.stringify(scopesArray)}`);
            session = await this.options.authentication.getSession(provider, scopesArray, sessionOptions);
        }

        if (!session) {
            return null;
        }

        const { expiresOnTimestamp, refreshAfterTimestamp } = getTokenExpiry(session.idToken);
        this.options.logger?.info(`[auth] token acquired provider=${provider} scopes=${JSON.stringify(scopesArray)} expiresOn=${expiresOnTimestamp}`);

        return {
            token: session.accessToken,
            expiresOnTimestamp,
            refreshAfterTimestamp,
            tokenType: 'Bearer',
        };
    }

    private getProviderId(): string {
        if (this.options.authProviderId) {
            return this.options.authProviderId;
        }
        if (!this.options.environment || this.options.environment.name === AzurePublicCloud.name) {
            return PublicAuthProviderId;
        }
        return SovereignAuthProviderId;
    }
}
