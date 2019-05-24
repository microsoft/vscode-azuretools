/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IActionContext } from '..';
import { callWithTelemetryAndErrorHandling, callWithTelemetryAndErrorHandlingSync } from '../src/callWithTelemetryAndErrorHandling';
import { assertThrowsAsync } from './assertThrowsAsync';

function testFunc(): string {
    return 'testFunc';
}

async function testFuncAsync(): Promise<string> {
    return 'testFuncAsync';
}

function testFuncError(): string {
    throw new Error('testFuncError');
}

async function testFuncErrorAsync(): Promise<string> {
    throw new Error('testFuncErrorAsync');
}

suite('callWithTelemetryAndErrorHandling tests', () => {
    test('sync', async () => {
        assert.equal(callWithTelemetryAndErrorHandlingSync('callbackId', testFunc), testFunc());
        assert.equal(callWithTelemetryAndErrorHandlingSync('callbackId', testFuncError), undefined);

        assert.throws(
            () => callWithTelemetryAndErrorHandlingSync('callbackId', (context: IActionContext) => {
                context.errorHandling.rethrow = true;
                return testFuncError();
            }),
            /testFuncError/);

        assert.doesNotThrow(
            () => callWithTelemetryAndErrorHandlingSync('callbackId', async (context: IActionContext) => {
                context.errorHandling.rethrow = true;
                return await testFuncErrorAsync();
            }));
    });

    test('async', async () => {
        assert.equal(await callWithTelemetryAndErrorHandling('callbackId', testFunc), testFunc());
        assert.equal(await callWithTelemetryAndErrorHandling('callbackId', testFuncAsync), await testFuncAsync());
        assert.equal(await callWithTelemetryAndErrorHandling('callbackId', testFuncError), undefined);
        assert.equal(await callWithTelemetryAndErrorHandling('callbackId', testFuncErrorAsync), undefined);

        await assertThrowsAsync(
            async () => await callWithTelemetryAndErrorHandling('callbackId', async (context: IActionContext) => {
                context.errorHandling.rethrow = true;
                return testFuncError();
            }),
            /testFuncError/);

        await assertThrowsAsync(
            async () => await callWithTelemetryAndErrorHandling('callbackId', async (context: IActionContext) => {
                context.errorHandling.rethrow = true;
                return testFuncErrorAsync();
            }),
            /testFuncErrorAsync/);
    });
});
