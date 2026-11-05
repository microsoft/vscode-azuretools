/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { createTestActionContext } from '../src/dev/TestActionContext';
import { UserCancelledError } from '../src/errors';
import { addExtensionValueToMask, addValuesToMaskFromAzureId, callWithMaskHandling, maskUserInfo, maskValue } from '../src/masking';
import { randomUtils } from '../src/utils/randomUtils';

suite('masking', () => {
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

        test('masks credentials before HTML and XML summaries lose text', async () => {
            const credential = 'synthetic-credential-' + 'Z'.repeat(44);
            for (const [opening, closing] of [['<html><title>', '</title></html>'], ['<Message>', '</Message>']]) {
                for (const [value, content] of [
                    [credential, credential],
                    ['private words', 'private words'],
                    ['private\nwords', 'private\nwords'],
                    ['private words', 'private&#32;words'],
                    ['private\nwords', 'private&#10;words']
                ]) {
                    const prefix = 'x'.repeat(250);
                    await assert.rejects(
                        callWithMaskHandling(() => Promise.reject(new Error(`${opening}${prefix}${content}${closing}`)), value),
                        (error: unknown) => error instanceof Error && error.message === `${prefix}---`
                    );
                }
            }
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

        test('does not guess which values are sensitive', () => {
            for (const value of [
                'User dave /dave/ a.buser',
                'c35d6342-5917-46f8-953e-9d3faffd1c72',
                '127.0.0.1',
                '000-111-2222',
                'microsoft.com microsoft.org microsoft.net',
                'Contact alice@cafe.de',
                'https://host/path',
                '"POSTGRES_PASSWORD": "private\nwords"',
                '--token private'
            ]) {
                assert.strictEqual(maskUserInfo(value, []), value);
            }
        });

        test('ignores legacy heuristic options without looking up usernames', () => {
            const legacyMaskUserInfo: typeof import('../index').maskUserInfo = maskUserInfo;
            const message = 'User dave at alice@cafe.de on 127.0.0.1';
            assert.strictEqual(legacyMaskUserInfo(message, [], false, () => { throw new Error('Must not look up usernames'); }), message);
            assert.strictEqual(legacyMaskUserInfo(message, ['127.0.0.1'], true), 'User dave at alice@cafe.de on ---');
        });

        test('explicit secrets remain protected', () => {
            const secret = 'private words';
            assert.strictEqual(maskUserInfo(`Credential: ${secret} at https://host`, [secret, 'https://host']), 'Credential: --- at ---');
        });

        test('converts non-string inputs', () => {
            for (const [input, expected] of [[4, '4'], [true, 'true'], [undefined, 'undefined'], [null, 'null'], [{}, '[object Object]'], [[], '']] as const) {
                assert.strictEqual(maskUserInfo(input, []), expected);
            }
        });
    });

    test('maskValue handles empty and literal values', () => {
        assert.strictEqual(maskValue('hello', undefined), 'hello');
        assert.strictEqual(maskValue('hello', ''), 'hello');
        assert.strictEqual(maskValue('a+b A+B a%2Bb', 'a+b'), '--- --- ---');
    });
});
