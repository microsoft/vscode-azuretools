/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type * as vscode from "vscode";

// Copied straight from https://github.com/microsoft/vscode/blob/32a309c4eceb1df1252215e36766ffb7e4e5afb3/src/vs/workbench/services/authentication/common/authentication.ts#L80-L85
export function isAuthenticationWwwAuthenticateRequest(obj: unknown): obj is vscode.AuthenticationWwwAuthenticateRequest {
    return typeof obj === 'object'
        && obj !== null
        && 'wwwAuthenticate' in obj
        && (typeof obj.wwwAuthenticate === 'string');
}
