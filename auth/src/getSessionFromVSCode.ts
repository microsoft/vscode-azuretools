/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from "./utils/configuredAzureEnv";
import { isAuthenticationSessionRequest } from "./utils/isAuthenticationSessionRequest";

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

function getScopes(scopes: string | string[] | undefined, tenantId?: string): string[] {
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
function formScopesArg(scopes?: string | string[] | vscode.AuthenticationSessionRequest, tenantId?: string): string[] | vscode.AuthenticationSessionRequest {
    const initialScopeList: string[] | undefined = typeof scopes === 'string' ? [scopes] : Array.isArray(scopes) ? scopes : Array.from(scopes?.scopes ?? []);
    const scopeList = getScopes(initialScopeList, tenantId);
    return isAuthenticationSessionRequest(scopes) ? { scopes: scopeList, challenge: scopes.challenge } : scopeList;
}

/**
 * Wraps {@link vscode.authentication.getSession} and handles:
 * * Passing the configured auth provider id
 * * Getting the list of scopes, adding the tenant id to the scope list if needed
 *
 * @param scopes - top-level resource scopes (e.g. http://management.azure.com, http://storage.azure.com) or .default scopes. All resources/scopes will be normalized to the `.default` scope for each resource.
 * Use `vscode.AuthenticationSessionRequest` if you need to pass in a challenge (WWW-Authenticate header). Note: Use of `vscode.AuthenticationSessionRequest` requires VS Code 1.104 or newer.
 * @param tenantId - (Optional) The tenant ID, will be added to the scopes
 * @param options - see {@link vscode.AuthenticationGetSessionOptions}
 * @returns An authentication session if available, or undefined if there are no sessions
 */
export async function getSessionFromVSCode(scopes?: string | string[] | vscode.AuthenticationSessionRequest, tenantId?: string, options?: vscode.AuthenticationGetSessionOptions): Promise<vscode.AuthenticationSession | undefined> {
    return await vscode.authentication.getSession(getConfiguredAuthProviderId(), formScopesArg(scopes, tenantId), options);
}
