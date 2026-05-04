/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Deferred } from '../../src/webview/Channel/DeferredPromise';

suite('(unit) Deferred', () => {
    test('resolves with the provided value', async () => {
        const d = new Deferred<number>();
        d.resolve(42);
        assert.strictEqual(await d.promise, 42);
    });

    test('rejects with the provided reason', async () => {
        const d = new Deferred<number>();
        d.reject(new Error('boom'));
        await assert.rejects(d.promise, /boom/);
    });

    test('only settles once', async () => {
        const d = new Deferred<string>();
        d.resolve('first');
        d.resolve('second');
        d.reject(new Error('ignored'));
        assert.strictEqual(await d.promise, 'first');
    });
});
