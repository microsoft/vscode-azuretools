/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

interface TokenJson {
    // More properties exist but they are ignored
    exp?: number;
}

/**
 * Tries to parse a token for an expiration timestamp
 * @param token The token to parse for an expiration timestamp
 * @returns The expiration timestamp, or zero if the token could not be parsed
 */
export function tryParseExpiresOnFromToken(token: string): number {
    try {
        // The token is typically base-64 encoded JSON
        // TODO: using `Buffer` makes this package not-polymorphic!
        const tokenJson = Buffer.from(token, 'base64').toString('utf8');
        const tokenObject = JSON.parse(tokenJson) as TokenJson;
        return tokenObject.exp ?? 0;
    } catch {
        return 0;
    }
}
