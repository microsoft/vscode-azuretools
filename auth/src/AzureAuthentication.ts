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
     * Always uses the default scope, `https://management.azure.com/.default/` and respects `microsoft-sovereign-cloud.environment` setting.
     *
     * @returns A VS Code authentication session or undefined, if none could be obtained.
     */
    getSession(): vscode.ProviderResult<vscode.AuthenticationSession>;
    /**
     * Gets a VS Code authentication session for an Azure subscription.
     *
     * @param scopes - The scopes for which the authentication is needed.
     *
     * @returns A VS Code authentication session or undefined, if none could be obtained.
     */
    getSessionWithScopes(scopes: string[]): vscode.ProviderResult<vscode.AuthenticationSession>;
}
