/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vscode';
import type { IActionContext } from './types/actionContext';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { ext } from './extensionVariables';

/**
 * Used to register VSCode events. It wraps your callback with consistent error and telemetry handling
 * NOTE #1: By default, this sends a telemetry event every single time the event fires. It it recommended to use 'context.telemetry.suppressIfSuccessful' to only send events if they apply to your extension
 * NOTE #2: If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then telemetry will not be sent. If the value is 'verbose' or 'v', telemetry will be displayed in the console window.
 */
export function registerEvent<T>(eventId: string, event: Event<T>, callback: (context: IActionContext, ...args: unknown[]) => unknown): void {
    ext.context.subscriptions.push(event(async (...args: unknown[]): Promise<unknown> => {
        return await callWithTelemetryAndErrorHandling(
            eventId,
            (context: IActionContext) => {
                return callback(context, ...args);
            }
        );
    }));
}
