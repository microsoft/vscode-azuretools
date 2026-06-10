/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { VsCodeAuthentication } from '../contracts/AzureAuthVsCode';
import { isAuthenticationWwwAuthenticateRequest } from './isAuthenticationWwwAuthenticateRequest';

function ensureEndingSlash(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
}

function getResourceScopes(defaultScopeResource: string, scopes?: string | string[]): string[] {
    if (scopes === undefined || scopes === "" || scopes.length === 0) {
        // For https://github.com/microsoft/vscode-azurefunctions/issues/3913, the default scope is
        // ~'https://management.core.windows.net/.default' (`EnvironmentLike.managementEndpointUrl`)
        // rather than the resource manager endpoint, to avoid stale-MSAL-cache refresh failures.
        scopes = ensureEndingSlash(defaultScopeResource);
    }
    const arrScopes = (Array.isArray(scopes) ? scopes : [scopes])
        .map((scope) => {
            if (scope.endsWith('.default')) {
                return scope;
            } else {
                return `${scope}.default`;
            }
        });
    return Array.from(new Set<string>(arrScopes));
}

function addTenantIdScope(scopes: string[], tenantId: string): string[] {
    const scopeSet = new Set<string>(scopes);
    scopeSet.add(`VSCODE_TENANT:${tenantId}`);
    return Array.from(scopeSet);
}

function getModifiedScopes(defaultScopeResource: string, scopes: string | string[] | undefined, tenantId?: string): string[] {
    let scopeArr = getResourceScopes(defaultScopeResource, scopes);
    if (tenantId) {
        scopeArr = addTenantIdScope(scopeArr, tenantId);
    }
    return scopeArr;
}

/**
 * Deconstructs and rebuilds the scopes arg in order to use the above utils to modify the scopes array.
 * And then returns the proper type to pass directly to vscode.authentication.getSession
 */
function formScopesArg(defaultScopeResource: string, scopeOrListOrRequest?: string | string[] | vscode.AuthenticationWwwAuthenticateRequest, tenantId?: string): string[] | vscode.AuthenticationWwwAuthenticateRequest {
    const isChallenge = isAuthenticationWwwAuthenticateRequest(scopeOrListOrRequest);

    let initialScopeList: string[] | undefined = undefined;
    if (typeof scopeOrListOrRequest === 'string' && !!scopeOrListOrRequest) {
        initialScopeList = [scopeOrListOrRequest];
    } else if (Array.isArray(scopeOrListOrRequest)) {
        initialScopeList = scopeOrListOrRequest;
    } else if (isChallenge) {
        // `scopeOrListOrRequest.fallbackScopes` being readonly forces us to rebuild the array
        initialScopeList = scopeOrListOrRequest.fallbackScopes ? Array.from(scopeOrListOrRequest.fallbackScopes) : undefined;
    }

    const modifiedScopeList = getModifiedScopes(defaultScopeResource, initialScopeList, tenantId);

    return isChallenge ? { fallbackScopes: modifiedScopeList, wwwAuthenticate: scopeOrListOrRequest.wwwAuthenticate } : modifiedScopeList;
}

/**
 * The context needed to acquire a VS Code authentication session.
 */
export interface GetSessionContext {
    /**
     * The injected VS Code `authentication` namespace.
     */
    readonly authentication: VsCodeAuthentication;

    /**
     * The auth provider ID to acquire sessions from (e.g. `'microsoft'`).
     */
    readonly authProviderId: string;

    /**
     * The default scope resource (the cloud's `managementEndpointUrl`) used when no scopes are supplied.
     */
    readonly defaultScopeResource: string;
}

/**
 * A dependency-injected version of the legacy `getSessionFromVSCode`. Wraps
 * {@link vscode.authentication.getSession} and handles:
 * * Passing the configured auth provider id
 * * Getting the list of scopes, adding the tenant id to the scope list if needed
 *
 * @param context The {@link GetSessionContext} providing the injected authentication namespace, provider id, and default scope resource.
 * @param scopeOrListOrRequest - top-level resource scopes or `.default` scopes (normalized to `.default`),
 * or a {@link vscode.AuthenticationWwwAuthenticateRequest} challenge. Use of the challenge form requires VS Code 1.105.0 or newer.
 * @param tenantId - (Optional) The tenant ID, will be added to the scopes
 * @param options - see {@link vscode.AuthenticationGetSessionOptions}
 * @returns An authentication session if available, or undefined if there are no sessions
 */
export async function getSessionFromVSCode(context: GetSessionContext, scopeOrListOrRequest?: string | string[] | vscode.AuthenticationWwwAuthenticateRequest, tenantId?: string, options?: vscode.AuthenticationGetSessionOptions): Promise<vscode.AuthenticationSession | undefined> {
    return await context.authentication.getSession(context.authProviderId, formScopesArg(context.defaultScopeResource, scopeOrListOrRequest, tenantId), options);
}
