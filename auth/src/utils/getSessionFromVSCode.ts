/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { getSessionFromVSCodeCore } from "./getSessionFromVSCodeCore";
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from "./configuredAzureEnv";

/**
 * Wraps {@link vscode.authentication.getSession} and handles:
 * * Passing the configured auth provider id
 * * Getting the list of scopes, adding the tenant id to the scope list if needed
 *
 * @remarks This binds the dependency-injected {@link getSessionFromVSCodeCore} to the real `vscode`
 * namespace and the configured auth provider id / default scope resource.
 *
 * @param scopeOrListOrRequest - top-level resource scopes (e.g. http://management.azure.com, http://storage.azure.com) or .default scopes. All resources/scopes will be normalized to the `.default` scope for each resource.
 * Use `vscode.AuthenticationWwwAuthenticateRequest` if you need to pass in a challenge (WWW-Authenticate header). Note: Use of `vscode.AuthenticationWwwAuthenticateRequest` requires VS Code 1.105.0 or newer.
 * @param tenantId - (Optional) The tenant ID, will be added to the scopes
 * @param options - see {@link vscode.AuthenticationGetSessionOptions}
 * @returns An authentication session if available, or undefined if there are no sessions
 */
export async function getSessionFromVSCode(scopeOrListOrRequest?: string | string[] | vscode.AuthenticationWwwAuthenticateRequest, tenantId?: string, options?: vscode.AuthenticationGetSessionOptions): Promise<vscode.AuthenticationSession | undefined> {
    return await getSessionFromVSCodeCore(
        {
            authentication: vscode.authentication,
            authProviderId: getConfiguredAuthProviderId(),
            defaultScopeResource: getConfiguredAzureEnv().managementEndpointUrl,
        },
        scopeOrListOrRequest,
        tenantId,
        options,
    );
}
