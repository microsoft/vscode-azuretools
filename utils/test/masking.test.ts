/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { createTestActionContext } from '../src/dev/TestActionContext';
import { UserCancelledError } from '../src/errors';
import { addExtensionValueToMask, addValuesToMaskFromAzureId, callWithMaskHandling, maskUserInfo, maskValue, resetUsernameMask } from '../src/masking';
import { randomUtils } from '../src/utils/randomUtils';
import { runWithTimeout } from './runWithTimeout';

suite('masking', () => {
    teardown(() => resetUsernameMask());

    suite('callWithMaskHandling', () => {
        test('removes literal and encoded credentials before rethrowing', async () => {
            const credential = 'sample+credential/[with].punctuation';
            await assert.rejects(
                callWithMaskHandling(() => Promise.reject(new Error(`Failed: ${credential} ${encodeURIComponent(credential)}`)), credential),
                (error: unknown) => error instanceof Error && error.message === 'Failed: --- ---' && error.cause === undefined
            );
        });

        test('preserves cancellations', async () => {
            const error = new UserCancelledError();
            await assert.rejects(callWithMaskHandling(() => Promise.reject(error), 'sample'), actual => actual === error);
        });

        test('returns successful results', async () => {
            assert.strictEqual(await callWithMaskHandling(() => Promise.resolve('result'), 'sample'), 'result');
        });
    });

    suite('maskUserInfo', () => {
        test('masks explicit values longest first without changing the caller array', () => {
            const values = ['firstName', 'firstNameLastName'];
            assert.strictEqual(maskUserInfo('firstNameLastName FIRSTNAME', values), '--- ---');
            assert.deepStrictEqual(values, ['firstName', 'firstNameLastName']);
            assert.strictEqual(maskUserInfo('literal a+b/c and a%2Bb%2Fc', ['a+b/c']), 'literal --- and ---');
        });

        test('masks action and extension values', () => {
            const value = randomUtils.getRandomHexString();
            addExtensionValueToMask(value, undefined, '');
            assert.strictEqual(maskUserInfo(`${value} action`, ['action']), '--- ---');
        });

        test('masks values from an Azure resource ID', async () => {
            const id = `/subscriptions/${randomUtils.getRandomHexString()}/resourceGroups/${randomUtils.getRandomHexString()}/providers/Microsoft.Web/sites/${randomUtils.getRandomHexString()}`;
            const context = await createTestActionContext();
            addValuesToMaskFromAzureId(context, id);
            assert.strictEqual(maskUserInfo(id, context.valuesToMask), '/subscriptions/---/resourceGroups/---/providers/Microsoft.Web/sites/---');
        });

        test('retains username boundaries and case-insensitive matching', () => {
            assert.strictEqual(maskUserInfo('User dave Dave /dave/ davecan Userdave', [], false, () => 'dave'),
                'User redacted:username redacted:username /redacted:username/ davecan Userdave');
        });

        test('retains short-username exclusions', () => {
            assert.strictEqual(maskUserInfo('User dav', [], false, () => 'dav'), 'User dav');
        });

        test('treats username regex metacharacters literally', () => {
            for (const username of ['a.buser', 'a+buser', 'a[b]user', 'a(b)user', 'a\\buser']) {
                resetUsernameMask();
                assert.strictEqual(maskUserInfo(`User ${username} is aXbuser`, [], true, () => username), 'User redacted:username is aXbuser');
            }
        });

        test('retains GUID, IP and phone-like ID masking', () => {
            for (const value of ['c35d6342-5917-46f8-953e-9d3faffd1c72', 'C35D6342591746F8953E9D3FAFFD1C72', '127.0.0.1', 'aaaa:0000:0000:0000:ffff:0000:0000:0001', '000-111-2222']) {
                assert.strictEqual(maskUserInfo(`(${value})`, []), '(redacted:id)');
                assert.strictEqual(maskUserInfo(value, [], true), value);
            }
        });

        test('retains bare-domain coverage and .NET exceptions', () => {
            assert.strictEqual(maskUserInfo('(microsoft.com), microsoft.org?q=yes microsoft.NET', [], true), 'redacted:url redacted:url redacted:url');
            assert.strictEqual(maskUserInfo('.NET ASP.NET ASP.NET, microsoft-asp.net microsoftasp.net', [], true), '.NET ASP.NET ASP.NET, redacted:url redacted:url');
        });

        test('leaves telemetry-covered formats to VS Code, not a local telemetry logger', () => {
            for (const value of [
                'user@example.invalid',
                'https://host/path',
                'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature',
                'password="private words"',
                '"POSTGRES_PASSWORD": "private\nwords"',
                '--token private'
            ]) {
                for (const lessAggressive of [false, true]) {
                    assert.strictEqual(maskUserInfo(value, [], lessAggressive), value);
                }
            }
        });

        test('explicit secrets remain protected regardless of heuristic coverage', () => {
            assert.strictEqual(maskUserInfo('password="private words" https://host', ['private words', 'https://host'], true), 'password="---" ---');
        });

        test('converts non-string inputs', () => {
            for (const [input, expected] of [[4, '4'], [true, 'true'], [undefined, 'undefined'], [null, 'null'], [{}, '[object Object]'], [[], '']] as const) {
                assert.strictEqual(maskUserInfo(input, []), expected);
            }
        });

        test('supplementary masking completes under an external deadline', async function () {
            this.timeout(20000);
            await runWithTimeout(`
                for (const size of [10000, 100000]) {
                    for (const input of ['!'.repeat(size), 'e.'.repeat(size), 'asp.'.repeat(size), 'key='.repeat(size)]) {
                        assert.strictEqual(maskUserInfo(input, [], true), input);
                    }
                    assert.strictEqual(maskUserInfo('!'.repeat(size) + '.com', [], true), 'redacted:url');
                }
            `);
        });
    });

    test('maskValue handles empty and literal values', () => {
        assert.strictEqual(maskValue('hello', undefined), 'hello');
        assert.strictEqual(maskValue('hello', ''), 'hello');
        assert.strictEqual(maskValue('a+b A+B a%2Bb', 'a+b'), '--- --- ---');
    });
});
