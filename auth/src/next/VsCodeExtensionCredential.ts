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
import { getTokenExpiry } from './utils/tryGetTokenExpiration';

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
     * Controls session creation behavior (e.g. `silent`, `createIfNone`).
     */
    readonly sessionOptions?: vscode.AuthenticationGetSessionOptions;
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
     * no session is available.
     */
    public async getToken(scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> {
        const scopesArray = Array.isArray(scopes) ? [...scopes] : [scopes];

        const provider = this.getProviderId();

        const tenantId = options?.tenantId || this.options.tenantId;
        if (tenantId) {
            scopesArray.push(`VSCODE_TENANT:${tenantId}`);
        }

        // A "claims" challenge (e.g. Conditional Access / MFA step-up) must be satisfiable interactively,
        // so reconstruct a WWW-Authenticate request from the claims and force an interactive sign-in.
        const claims = options?.claims;
        let session: vscode.AuthenticationSession | undefined;
        if (claims) {
            this.options.logger?.info(`[auth] getToken challenge provider=${provider} tenant=${tenantId ?? '<default>'} scopes=${JSON.stringify(scopesArray)}`);
            const request: vscode.AuthenticationWwwAuthenticateRequest = {
                wwwAuthenticate: `Bearer realm="", error="insufficient_claims", claims="${Buffer.from(claims).toString('base64')}"`,
                fallbackScopes: scopesArray,
            };
            // `createIfNone` and `silent` are mutually exclusive, so drop any silent/non-interactive option
            // before forcing an interactive prompt to satisfy the challenge.
            const interactiveOptions: vscode.AuthenticationGetSessionOptions = { ...this.options.sessionOptions, createIfNone: true };
            delete interactiveOptions.silent;
            session = await this.options.authentication.getSession(provider, request, interactiveOptions);
        } else {
            this.options.logger?.info(`[auth] getToken start provider=${provider} tenant=${tenantId ?? '<default>'} scopes=${JSON.stringify(scopesArray)}`);
            session = await this.options.authentication.getSession(provider, scopesArray, this.options.sessionOptions);
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
