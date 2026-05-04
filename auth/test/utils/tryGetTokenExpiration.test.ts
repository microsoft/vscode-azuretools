/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type * as vscode from 'vscode';
import { tryGetTokenExpiration } from '../../src/utils/tryGetTokenExpiration';

suite('(unit) tryGetTokenExpiration()', () => {
    function createSession(idToken: string): vscode.AuthenticationSession {
        return {
            id: 'session-id',
            accessToken: 'access-token',
            account: { id: 'account-id', label: 'account-label' },
            scopes: [],
            idToken,
        };
    }

    function createToken(payload: object): string {
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        return `${header}.${body}.signature`;
    }

    test('returns expiration in milliseconds from a base64url payload', () => {
        const session = createSession(createToken({ exp: 1735689600 }));

        assert.strictEqual(tryGetTokenExpiration(session), 1735689600000);
    });

    test('returns 0 if exp claim is missing', () => {
        const session = createSession(createToken({}));

        assert.strictEqual(tryGetTokenExpiration(session), 0);
    });
});
