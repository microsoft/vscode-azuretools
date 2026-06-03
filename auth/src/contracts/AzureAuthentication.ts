/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';

/**
 * Represents a means of obtaining authentication data for an Azure subscription.
 */
export interface AzureAuthentication {
    /**
     * Gets a VS Code authentication session for an Azure subscription.
     * Always uses the default scope, ~`https://management.core.windows.net/.default` and respects `microsoft-sovereign-cloud.environment` setting.
     *
     * @returns A VS Code authentication session or undefined, if none could be obtained.
     */
    getSession(): vscode.ProviderResult<vscode.AuthenticationSession>;
    /**
     * Gets a VS Code authentication session for an Azure subscription.
     *
     * @param scopeListOrRequest - The scopes or request for which the authentication is needed.
     * @param options - (Optional) Options controlling how the session is acquired. By default a plain
     * scope list is acquired silently; set `createIfNone` to allow an interactive consent prompt when
     * no session for the requested scopes has been granted yet. Challenge requests always allow prompting.
     *
     * @returns A VS Code authentication session or undefined, if none could be obtained.
     */
    getSessionWithScopes(scopeListOrRequest: string[] | vscode.AuthenticationWwwAuthenticateRequest, options?: GetSessionWithScopesOptions): vscode.ProviderResult<vscode.AuthenticationSession>;
}

/**
 * Options for {@link AzureAuthentication.getSessionWithScopes}.
 */
export interface GetSessionWithScopesOptions {
    /**
     * Whether to allow an interactive prompt (sign in / consent) if no session for the requested
     * scopes is already available. Defaults to `false`, in which case the session is acquired silently.
     */
    createIfNone?: boolean;
}
