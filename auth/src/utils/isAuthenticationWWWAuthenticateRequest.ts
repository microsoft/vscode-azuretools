/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type * as vscode from "vscode";

// This is copied from https://github.com/microsoft/vscode/blob/5e9d89e4983f1f618b70399edebdad5faed2165b/src/vscode-dts/vscode.proposed.authenticationChallenges.d.ts#L14-L38
// However, creating our own copy removes the need for the VSCode typing .d.ts files to bubble up to every consumer
// TODO: when the API is no longer proposed, remove this interface
export interface IAuthenticationWWWAuthenticateRequest {
    /**
     * The raw WWW-Authenticate header value that triggered this challenge.
     * This will be parsed by the authentication provider to extract the necessary
     * challenge information.
     */
    readonly wwwAuthenticate: string;

    /**
     * @deprecated Use `wwwAuthenticate` instead.
     */
    readonly challenge?: string;

    /**
     * Optional scopes for the session. If not provided, the authentication provider
     * may use default scopes or extract them from the challenge.
     */
    readonly scopes?: readonly string[];
}

// Copied straight from https://github.com/microsoft/vscode/blob/f3be94030f494dea887b53358a5e21ed9b4607e5/src/vs/workbench/services/authentication/common/authentication.ts#L80-L85
export function isAuthenticationWWWAuthenticateRequest(obj: unknown): obj is IAuthenticationWWWAuthenticateRequest {
    return typeof obj === 'object'
        && obj !== null
        && 'wwwAuthenticate' in obj
        && (typeof obj.wwwAuthenticate === 'string');
}

/**
 * Shape enforcement for IAuthenticationWWWAuthenticateRequest. Compile time checks will enforce that it matches vscode.AuthenticationWWWAuthenticateRequest,
 * without bubbling the VSCode types up to consumers.
 */
// @ts-expect-error The constant is neither exported nor used
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const shapeEnforcement: IAuthenticationWWWAuthenticateRequest = {
    wwwAuthenticate: 'foo',
    challenge: 'foo',
    scopes: ['foo']
} satisfies vscode.AuthenticationWWWAuthenticateRequest;
