/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Worker } from 'node:worker_threads';

/**
 * Run adversarial synchronous inputs outside Mocha's thread so its deadline can interrupt them.
 * Only the small VS Code surface needed by these string utilities is stubbed.
 */
export async function runWithTimeout(source: string): Promise<void> {
    const worker = new Worker(`
        const { workerData } = require('node:worker_threads');
        const Module = require('node:module');
        const load = Module._load;
        Module._load = function (id, ...args) {
            return id === 'vscode'
                ? { l10n: { t: (value, ...args) => value.replace(/\\{(\\d+)\\}/g, (_, index) => String(args[index])) }, CancellationError: class extends Error {} }
                : load.call(this, id, ...args);
        };
        require(workerData.tsx);
        const assert = require('node:assert/strict');
        const { maskUserInfo } = require(workerData.masking);
        const { parseError } = require(workerData.parseError);
        eval(workerData.source);
    `, {
        eval: true,
        workerData: {
            source,
            tsx: require.resolve('tsx/cjs'),
            masking: require.resolve('../src/masking'),
            parseError: require.resolve('../src/parseError')
        }
    });
    try {
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('String processing exceeded the 15 second worker deadline')), 15000);
            worker.once('error', error => {
                clearTimeout(timer);
                reject(error);
            });
            worker.once('exit', code => {
                clearTimeout(timer);
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`String processing worker exited with code ${code}`));
                }
            });
        });
    } finally {
        await worker.terminate();
    }
}
