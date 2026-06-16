/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
class TimeoutError extends Error { }

/**
 * Returns the result of awaiting a specified action. Rejects if the action throws. Returns timeoutValue if a time-out occurs.
 */
export async function valueOnTimeout<T>(timeoutMs: number, timeoutValue: T, action: () => Promise<T> | T): Promise<T> {
    try {
        return await rejectOnTimeout(timeoutMs, action);
    } catch (err) {
        if (err instanceof TimeoutError) {
            return timeoutValue;
        }

        throw err;
    }
}

/**
 * Returns the result of awaiting a specified action. Rejects if the action throws or if the time-out occurs.
 */
export function rejectOnTimeout<T>(timeoutMs: number, action: () => Promise<T> | T, callerTimeOutMessage?: string): Promise<T> {
    return new Promise<T>((resolve, reject): void => {
        let timer: NodeJS.Timeout | undefined = setTimeout(
            () => {
                timer = undefined;
                reject(new TimeoutError(callerTimeOutMessage || vscode.l10n.t('Execution timed out.')));
            },
            timeoutMs);

        let value: T;
        let error: unknown;

        try {
            void (async (): Promise<void> => {
                try {
                    value = await action();
                    clearTimeout(timer);
                    resolve(value);
                } catch (err) {
                    error = err;
                    clearTimeout(timer);
                    reject(error instanceof Error ? error : new Error(String(error)));
                }
            })();
        } catch (err) {
            error = err;
            clearTimeout(timer);
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
}
