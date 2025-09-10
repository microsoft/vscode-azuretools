/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type * as vscode from "vscode";

// Copied straight from https://github.com/microsoft/vscode/blob/f3be94030f494dea887b53358a5e21ed9b4607e5/src/vs/workbench/services/authentication/common/authentication.ts#L80-L85
export function isAuthenticationWWWAuthenticateRequest(obj: unknown): obj is vscode.AuthenticationWWWAuthenticateRequest {
    return typeof obj === 'object'
        && obj !== null
        && 'wwwAuthenticate' in obj
        && (typeof obj.wwwAuthenticate === 'string');
}
