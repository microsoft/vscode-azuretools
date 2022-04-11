/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as net from 'net';
import { randomUtils } from './randomUtils';

const DefaultTimeout = 500; // Spend at most 500 ms
const DefaultMaxAttempts = 25; // On at most 25 attempts

const MinRandomPort = 10000;
const MaxRandomPort = 64000;

/**
 * Finds an available port.
 * NOTE: If another listener is on '0.0.0.0', this will take the '127.0.0.1' allocation from them!
 * @param startPort (Optional) The first port to try. By default, a random port from 10000 (inclusive) to 64000 (exclusive)
 * @param maxAttempts (Optional) The maximum number of attempts. 25, by default.
 * @param timeout (Optional) The maximum time to spend. 500 ms, by default.
 * Adapted from https://github.com/microsoft/vscode/blob/0bf30719729d76dc3db934ac2e04eed892a9ae7e/src/vs/base/node/ports.ts#L150-L191
 */
export async function findFreePort(startPort: number = 0, maxAttempts: number = DefaultMaxAttempts, timeout: number = DefaultTimeout): Promise<number> {
    // If a start port isn't given, the default is set to 0, and the `||=` will overwrite it with a random value
    startPort ||= randomUtils.getRandomInteger(MinRandomPort, MaxRandomPort);

    let resolved: boolean = false;
    let timeoutHandle: NodeJS.Timeout | undefined = undefined;
    let countTried: number = 1;
    const server = net.createServer({ pauseOnConnect: true });
    function doResolve(port: number, resolve: (port: number) => void) {
        if (!resolved) {
            resolved = true;
            server.removeAllListeners();
            server.close();
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            resolve(port);
        }
    }
    return new Promise<number>(resolve => {
        timeoutHandle = setTimeout(() => {
            doResolve(0, resolve);
        }, timeout);

        server.on('listening', () => {
            doResolve(startPort, resolve);
        });
        server.on('error', err => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
            if (err && ((<any>err).code === 'EADDRINUSE' || (<any>err).code === 'EACCES') && (countTried < maxAttempts)) {
                startPort += countTried;
                countTried++;
                server.listen(startPort, '127.0.0.1');
            } else {
                doResolve(0, resolve);
            }
        });
        server.on('close', () => {
            doResolve(0, resolve);
        });
        server.listen(startPort, '127.0.0.1');
    });
}
