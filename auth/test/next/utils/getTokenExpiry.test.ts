/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { getTokenExpiry } from '../../../src/next/utils/getTokenExpiry';

describe('(unit) getTokenExpiry()', () => {
    function createToken(payload: object): string {
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        return `${header}.${body}.signature`;
    }

    it('returns expiration in milliseconds from a base64url payload', () => {
        expect(getTokenExpiry(createToken({ exp: 1735689600 })).expiresOnTimestamp).to.equal(1735689600000);
    });

    it('returns 0 if exp claim is missing', () => {
        const { expiresOnTimestamp, refreshAfterTimestamp } = getTokenExpiry(createToken({}));
        expect(expiresOnTimestamp).to.equal(0);
        expect(refreshAfterTimestamp).to.equal(0);
    });

    it('returns 0 if the idToken is undefined', () => {
        const { expiresOnTimestamp, refreshAfterTimestamp } = getTokenExpiry(undefined);
        expect(expiresOnTimestamp).to.equal(0);
        expect(refreshAfterTimestamp).to.equal(0);
    });

    it('returns 0 if the idToken is malformed', () => {
        const { expiresOnTimestamp, refreshAfterTimestamp } = getTokenExpiry('not-a-jwt');
        expect(expiresOnTimestamp).to.equal(0);
        expect(refreshAfterTimestamp).to.equal(0);
    });

    it('sets refreshAfterTimestamp to ~2/3 of remaining lifetime', () => {
        const now = Date.now();
        const exp = Math.floor(now / 1000) + 3600;
        const { refreshAfterTimestamp } = getTokenExpiry(createToken({ exp }));
        const expectedRefresh = now + Math.floor((exp * 1000 - now) * 2 / 3);
        expect(Math.abs(refreshAfterTimestamp - expectedRefresh) < 2000).to.be.ok;
    });

    it('sets refreshAfterTimestamp to expiresOnTimestamp for an already-expired token', () => {
        const exp = Math.floor(Date.now() / 1000) - 60;
        const { expiresOnTimestamp, refreshAfterTimestamp } = getTokenExpiry(createToken({ exp }));
        expect(expiresOnTimestamp).to.equal(exp * 1000);
        expect(refreshAfterTimestamp).to.equal(exp * 1000);
    });
});
