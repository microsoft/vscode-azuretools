/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccessToken, TokenCredential } from '@azure/core-auth';
import * as vscode from 'vscode';

const msAuthProviderId: string = 'microsoft';
const defaultAzureManagementScope: string = 'https://management.azure.com/.default';

/**
 * A credential that implements {@link TokenCredential} and acquires its token through
 * the VSCode authentication provider API.
 */
export class VSCodeTokenCredential implements TokenCredential {
    /**
     * Gets the token through the VSCode authentication provider API
     * @param scopes The scopes for which the token will have access
     * @returns An {@link AccessToken} which contains the token and its expiration
     */
    public async getToken(scopes: string | string[]): Promise<AccessToken> {
        let scopesArray: string[];
        if (typeof scopes === 'string') {
            scopesArray = [scopes];
        } else if (Array.isArray(scopes)) {
            scopesArray = scopes;
        } else {
            scopesArray = [];
        }

        // TODO: how should the default scope be added?
        if (scopesArray.length === 0) {
            scopesArray = [defaultAzureManagementScope];
        }

        const session = await vscode.authentication.getSession(msAuthProviderId, scopesArray, { createIfNone: true });
        return {
            token: session.accessToken,
            expiresOnTimestamp: this.getExpirationTimestamp(session.accessToken),
        };
    }

    /**
     * Tries to get the expiration timestamp from the token
     * @param token The token to get the expiration timestamp from
     * @returns The expiration time in milliseconds since the Unix epoch
     */
    private getExpirationTimestamp(token: string): number {
        try {
            // The token is a JWT. The string is three base64 substrings separated by '.'. The second string is the actual token.
            // 1. Get the second string
            const tokenBody = token.split('.')[1];

            // 2. Decode from base64
            const decodedToken = Buffer.from(tokenBody, 'base64').toString('utf8');

            // 3. Parse the JSON
            const parsedToken = JSON.parse(decodedToken) as { exp: number };

            // 4. Return the expiration timestamp * 1000 (to convert to milliseconds)
            return parsedToken.exp * 1000;
        } catch {
            throw new Error('Unable to parse token expiration');
        }
    }
}
