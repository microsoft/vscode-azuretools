/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export function isAuthenticationSessionRequest(scopes?: string | string[] | vscode.AuthenticationSessionRequest): scopes is vscode.AuthenticationSessionRequest {
    return !!(scopes && typeof scopes === 'object' && 'challenge' in scopes);
}
