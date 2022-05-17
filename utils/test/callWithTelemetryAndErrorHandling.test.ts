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
        assert.strictEqual(callWithTelemetryAndErrorHandlingSync('callbackId', testFunc), testFunc());
        assert.strictEqual(callWithTelemetryAndErrorHandlingSync('callbackId', testFuncError), undefined);

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
        assert.strictEqual(await callWithTelemetryAndErrorHandling('callbackId', testFunc), testFunc());
        assert.strictEqual(await callWithTelemetryAndErrorHandling('callbackId', testFuncAsync), await testFuncAsync());
        assert.strictEqual(await callWithTelemetryAndErrorHandling('callbackId', testFuncError), undefined);
        assert.strictEqual(await callWithTelemetryAndErrorHandling('callbackId', testFuncErrorAsync), undefined);

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

    // https://github.com/microsoft/vscode-azuretools/issues/967
    test('Unexpected error during masking', async () => {
        const func = (context: IActionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            context.telemetry.properties.prop1 = <any>3;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            context.telemetry.measurements.meas1 = <any>'fdafs';
        }
        assert.strictEqual(await callWithTelemetryAndErrorHandling('callbackId', func), undefined);
    });

    test('Unexpected error during telemetry handling', async () => {
        const func = (context: IActionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            context.telemetry = <any>undefined;
        }
        assert.strictEqual(await callWithTelemetryAndErrorHandling('callbackId', func), undefined);
    });

    test('Unexpected error during error handling', async () => {
        const func = (context: IActionContext) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            context.errorHandling = <any>undefined;
            throw new Error('test');
        }
        assert.strictEqual(await callWithTelemetryAndErrorHandling('callbackId', func), undefined);
    });
});
