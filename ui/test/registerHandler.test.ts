/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { teardown } from 'mocha';
import { Disposable } from 'vscode';
import { ErrorHandler } from '..';
import { callWithTelemetryAndErrorHandling, registerErrorHandler, registerTelemetryHandler } from '../src/callWithTelemetryAndErrorHandling';

// tslint:disable-next-line: max-func-body-length
suite('registerHandler', () => {
    const errorCallback = () => { throw new Error('test'); };
    const doNothingCallback = () => { /* do nothing */ };

    let disposables: Disposable[] = [];
    teardown(() => {
        disposables.forEach(d => d.dispose());
        disposables = [];
    });

    suite('errorHandler', () => {
        function registerTestHandler(handler: ErrorHandler): Disposable {
            const disposable = registerErrorHandler(handler);
            disposables.push(disposable);
            return disposable;
        }

        test('no error', async () => {
            let runCount: number = 0;
            registerTestHandler(() => { runCount += 1; });
            await callWithTelemetryAndErrorHandling('testCallback', doNothingCallback);
            assert.equal(runCount, 0);
        });

        test('error', async () => {
            let runCount: number = 0;
            registerTestHandler(() => { runCount += 1; });
            await callWithTelemetryAndErrorHandling('testCallback', errorCallback);
            assert.equal(runCount, 1);
        });

        test('dispose before throwing error', async () => {
            let runCount: number = 0;
            const disposable = registerTestHandler(() => { runCount += 1; });
            disposable.dispose();
            await callWithTelemetryAndErrorHandling('testCallback', errorCallback);
            assert.equal(runCount, 0);
        });

        test('faulty handler', async () => {
            registerTestHandler(() => { throw new Error('oops'); });
            let runCount: number = 0;
            registerTestHandler(() => { runCount += 1; });
            await callWithTelemetryAndErrorHandling('testCallback', errorCallback);
            assert.equal(runCount, 1);
        });
    });

    suite('telemetryHandler', () => {
        function registerTestHandler(handler: ErrorHandler): Disposable {
            const disposable = registerTelemetryHandler(handler);
            disposables.push(disposable);
            return disposable;
        }

        test('no error', async () => {
            let runCount: number = 0;
            registerTestHandler(() => { runCount += 1; });
            await callWithTelemetryAndErrorHandling('testCallback', doNothingCallback);
            assert.equal(runCount, 1);
        });

        test('error', async () => {
            let runCount: number = 0;
            registerTestHandler(() => { runCount += 1; });
            await callWithTelemetryAndErrorHandling('testCallback', errorCallback);
            assert.equal(runCount, 1);
        });

        test('dispose', async () => {
            let runCount: number = 0;
            const disposable = registerTestHandler(() => { runCount += 1; });
            disposable.dispose();
            await callWithTelemetryAndErrorHandling('testCallback', doNothingCallback);
            assert.equal(runCount, 0);
        });

        test('dispose before throwing error', async () => {
            let runCount: number = 0;
            const disposable = registerTestHandler(() => { runCount += 1; });
            disposable.dispose();
            await callWithTelemetryAndErrorHandling('testCallback', errorCallback);
            assert.equal(runCount, 0);
        });

        test('faulty handler', async () => {
            registerTestHandler(() => { throw new Error('oops'); });
            let runCount: number = 0;
            registerTestHandler(() => { runCount += 1; });
            await callWithTelemetryAndErrorHandling('testCallback', doNothingCallback);
            assert.equal(runCount, 1);
        });

        test('multiple handlers', async () => {
            let runCount1: number = 0;
            registerTestHandler(() => { runCount1 += 1; });
            let runCount2: number = 0;
            registerTestHandler(() => { runCount2 += 1; });
            await callWithTelemetryAndErrorHandling('testCallback', doNothingCallback);
            assert.equal(runCount1, 1);
            assert.equal(runCount2, 1);
        });

        test('multiple handlers - dispose first handler', async () => {
            let runCount1: number = 0;
            const disposable1 = registerTestHandler(() => { runCount1 += 1; });
            let runCount2: number = 0;
            registerTestHandler(() => { runCount2 += 1; });

            disposable1.dispose();
            await callWithTelemetryAndErrorHandling('testCallback', doNothingCallback);
            assert.equal(runCount1, 0);
            assert.equal(runCount2, 1);
        });

        test('multiple handlers - dispose last handler', async () => {
            let runCount1: number = 0;
            registerTestHandler(() => { runCount1 += 1; });
            let runCount2: number = 0;
            const disposable2 = registerTestHandler(() => { runCount2 += 1; });

            disposable2.dispose();
            await callWithTelemetryAndErrorHandling('testCallback', doNothingCallback);
            assert.equal(runCount1, 1);
            assert.equal(runCount2, 0);
        });
    });
});
