/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from "./utils/configuredAzureEnv";
import { isAuthenticationWwwAuthenticateRequest } from "./utils/isAuthenticationWwwAuthenticateRequest";

function ensureEndingSlash(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
}

function getResourceScopes(scopes?: string | string[]): string[] {
    if (scopes === undefined || scopes === "" || scopes.length === 0) {
        scopes = ensureEndingSlash(getConfiguredAzureEnv().managementEndpointUrl);
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

function getModifiedScopes(scopes: string | string[] | undefined, tenantId?: string): string[] {
    let scopeArr = getResourceScopes(scopes);
    if (tenantId) {
        scopeArr = addTenantIdScope(scopeArr, tenantId);
    }
    return scopeArr;
}

/**
 * Deconstructs and rebuilds the scopes arg in order to use the above utils to modify the scopes array.
 * And then returns the proper type to pass directly to vscode.authentication.getSession
 */
function formScopesArg(scopeOrListOrRequest?: string | string[] | vscode.AuthenticationWwwAuthenticateRequest, tenantId?: string): string[] | vscode.AuthenticationWwwAuthenticateRequest {
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

    const modifiedScopeList = getModifiedScopes(initialScopeList, tenantId);

    return isChallenge ? { fallbackScopes: modifiedScopeList, wwwAuthenticate: scopeOrListOrRequest.wwwAuthenticate } : modifiedScopeList;
}

/**
 * Wraps {@link vscode.authentication.getSession} and handles:
 * * Passing the configured auth provider id
 * * Getting the list of scopes, adding the tenant id to the scope list if needed
 *
 * @param scopeOrListOrRequest - top-level resource scopes (e.g. http://management.azure.com, http://storage.azure.com) or .default scopes. All resources/scopes will be normalized to the `.default` scope for each resource.
 * Use `vscode.AuthenticationWwwAuthenticateRequest` if you need to pass in a challenge (WWW-Authenticate header). Note: Use of `vscode.AuthenticationWwwAuthenticateRequest` requires VS Code 1.105.0 or newer.
 * @param tenantId - (Optional) The tenant ID, will be added to the scopes
 * @param options - see {@link vscode.AuthenticationGetSessionOptions}
 * @returns An authentication session if available, or undefined if there are no sessions
 */
export async function getSessionFromVSCode(scopeOrListOrRequest?: string | string[] | vscode.AuthenticationWwwAuthenticateRequest, tenantId?: string, options?: vscode.AuthenticationGetSessionOptions): Promise<vscode.AuthenticationSession | undefined> {
    return await vscode.authentication.getSession(getConfiguredAuthProviderId(), formScopesArg(scopeOrListOrRequest, tenantId), options);
}
