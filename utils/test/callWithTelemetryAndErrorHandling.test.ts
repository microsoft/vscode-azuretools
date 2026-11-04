/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IActionContext } from '..';
import { callWithTelemetryAndErrorHandling, callWithTelemetryAndErrorHandlingSync, registerTelemetryHandler } from '../src/callWithTelemetryAndErrorHandling';
import { assertThrowsAsync } from './assertThrowsAsync';

function testFunc(): string {
    return 'testFunc';
}

function testFuncAsync(): Promise<string> {
    return Promise.resolve('testFuncAsync');
}

function testFuncError(): string {
    throw new Error('testFuncError');
}

function testFuncErrorAsync(): Promise<string> {
    return Promise.reject(new Error('testFuncErrorAsync'));
}

suite('callWithTelemetryAndErrorHandling tests', () => {
    test('masks explicit credentials before markup summaries are shortened', async () => {
        const messages: unknown[] = [];
        const handler = registerTelemetryHandler(context => {
            messages.push(context.telemetry.properties.errorMessage, context.telemetry.properties.errorMessageV2);
        });
        const credential = 'synthetic-credential-' + 'Z'.repeat(44);
        const prefix = 'x'.repeat(250);
        try {
            for (const message of [`<html><title>${prefix}${credential}</title></html>`, `<Message>${prefix}${credential}</Message>`]) {
                await callWithTelemetryAndErrorHandling('summaryMasking', context => {
                    context.errorHandling.suppressDisplay = true;
                    context.valuesToMask.push(credential);
                    throw new Error(message);
                });
            }
        } finally {
            handler.dispose();
        }
        assert.deepStrictEqual(messages, Array<string>(4).fill(`${prefix}---`));
    });

    test('sync', () => {
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
            () => callWithTelemetryAndErrorHandling('callbackId', (context: IActionContext) => {
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
            context.telemetry.properties.prop1 = <any>3;
            context.telemetry.measurements.meas1 = <any>'fdafs';
        };
        assert.strictEqual(await callWithTelemetryAndErrorHandling('callbackId', func), undefined);
    });

    test('Unexpected error during telemetry handling', async () => {
        const func = (context: IActionContext) => {
            context.telemetry = <any>undefined;
        };
        assert.strictEqual(await callWithTelemetryAndErrorHandling('callbackId', func), undefined);
    });

    test('Unexpected error during error handling', async () => {
        const func = (context: IActionContext) => {
            context.errorHandling = <any>undefined;
            throw new Error('test');
        };
        assert.strictEqual(await callWithTelemetryAndErrorHandling('callbackId', func), undefined);
    });
});
