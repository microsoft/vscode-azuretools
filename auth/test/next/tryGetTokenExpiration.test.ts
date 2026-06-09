/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getTokenExpiry } from '../../src/next/utils/tryGetTokenExpiration';

suite('(unit) getTokenExpiry()', () => {
    function createToken(payload: object): string {
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        return `${header}.${body}.signature`;
    }

    test('returns expiration in milliseconds from a base64url payload', () => {
        assert.strictEqual(getTokenExpiry(createToken({ exp: 1735689600 })).expiresOnTimestamp, 1735689600000);
    });

    test('returns 0 if exp claim is missing', () => {
        const { expiresOnTimestamp, refreshAfterTimestamp } = getTokenExpiry(createToken({}));
        assert.strictEqual(expiresOnTimestamp, 0);
        assert.strictEqual(refreshAfterTimestamp, 0);
    });

    test('returns 0 if the idToken is undefined', () => {
        const { expiresOnTimestamp, refreshAfterTimestamp } = getTokenExpiry(undefined);
        assert.strictEqual(expiresOnTimestamp, 0);
        assert.strictEqual(refreshAfterTimestamp, 0);
    });

    test('returns 0 if the idToken is malformed', () => {
        const { expiresOnTimestamp, refreshAfterTimestamp } = getTokenExpiry('not-a-jwt');
        assert.strictEqual(expiresOnTimestamp, 0);
        assert.strictEqual(refreshAfterTimestamp, 0);
    });

    test('sets refreshAfterTimestamp to ~2/3 of remaining lifetime', () => {
        const now = Date.now();
        const exp = Math.floor(now / 1000) + 3600;
        const { refreshAfterTimestamp } = getTokenExpiry(createToken({ exp }));
        const expectedRefresh = now + Math.floor((exp * 1000 - now) * 2 / 3);
        assert.ok(Math.abs(refreshAfterTimestamp - expectedRefresh) < 2000);
    });

    test('sets refreshAfterTimestamp to expiresOnTimestamp for an already-expired token', () => {
        const exp = Math.floor(Date.now() / 1000) - 60;
        const { expiresOnTimestamp, refreshAfterTimestamp } = getTokenExpiry(createToken({ exp }));
        assert.strictEqual(expiresOnTimestamp, exp * 1000);
        assert.strictEqual(refreshAfterTimestamp, exp * 1000);
    });
});
