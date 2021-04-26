/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vscode';
import * as types from '../index';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { ext } from './extensionVariables';

export function registerEvent<T>(eventId: string, event: Event<T>, callback: (context: types.IActionContext, ...args: unknown[]) => unknown): void {
    ext.context.subscriptions.push(event(async (...args: unknown[]): Promise<unknown> => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await callWithTelemetryAndErrorHandling(
            eventId,
            (context: types.IActionContext) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return callback(context, ...args);
            }
        );
    }));
}
