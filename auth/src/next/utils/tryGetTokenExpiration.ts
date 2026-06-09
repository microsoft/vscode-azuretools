/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The expiry information extracted from a JWT ID token.
 */
export interface TokenExpiry {
    /**
     * The token expiration time in milliseconds since the epoch, or `0` if it could not be determined.
     */
    readonly expiresOnTimestamp: number;

    /**
     * A suggested refresh time in milliseconds since the epoch, at 2/3 of the remaining lifetime. For an
     * already-expired (or undeterminable) token this equals {@link expiresOnTimestamp}.
     */
    readonly refreshAfterTimestamp: number;
}

/**
 * Best-effort extraction of `exp` from a JWT ID token. Returns `expiresOnTimestamp` in milliseconds and
 * `refreshAfterTimestamp` at 2/3 of the remaining lifetime. Falls back to `0` for both if the token is
 * missing or unparseable.
 *
 * @param idToken The JWT ID token to parse, or `undefined`.
 * @returns The {@link TokenExpiry} extracted from the token.
 */
export function getTokenExpiry(idToken: string | undefined): TokenExpiry {
    if (!idToken) {
        return { expiresOnTimestamp: 0, refreshAfterTimestamp: 0 };
    }

    try {
        const parts = idToken.split('.');
        if (parts.length < 2 || !parts[1]) {
            return { expiresOnTimestamp: 0, refreshAfterTimestamp: 0 };
        }

        // JWT payloads use base64url encoding; Node's Buffer handles this natively
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: number };
        if (typeof payload.exp !== 'number') {
            return { expiresOnTimestamp: 0, refreshAfterTimestamp: 0 };
        }

        const expiresOnTimestamp = payload.exp * 1000;
        const now = Date.now();
        const remaining = expiresOnTimestamp - now;
        const refreshAfterTimestamp = remaining > 0 ? now + Math.floor(remaining * 2 / 3) : expiresOnTimestamp;

        return { expiresOnTimestamp, refreshAfterTimestamp };
    } catch {
        return { expiresOnTimestamp: 0, refreshAfterTimestamp: 0 };
    }
}
