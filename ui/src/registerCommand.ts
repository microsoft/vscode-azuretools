/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, Uri } from 'vscode';
import * as types from '../index';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { ext } from './extensionVariables';
import { addValuesToMaskFromAzureId } from './masking';
import { AzExtTreeItem } from './tree/AzExtTreeItem';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerCommand(commandId: string, callback: (context: types.IActionContext, ...args: any[]) => any, debounce?: number): void {
    let lastClickTime: number | undefined; /* Used for debounce */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ext.context.subscriptions.push(commands.registerCommand(commandId, async (...args: any[]): Promise<any> => {
        if (debounce) { /* Only check for debounce if registered command specifies */
            if (debounceCommand(debounce, lastClickTime)) {
                return;
            }
            lastClickTime = Date.now();
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await callWithTelemetryAndErrorHandling(
            commandId,
            (context: types.IActionContext) => {
                if (args.length > 0) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                    const firstArg: any = args[0];

                    if (firstArg instanceof AzExtTreeItem) {
                        context.telemetry.properties.contextValue = firstArg.contextValue;
                        addValuesToMaskFromAzureId(context, firstArg.fullId);
                    } else if (firstArg instanceof Uri) {
                        context.telemetry.properties.contextValue = 'Uri';
                    }
                }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return callback(context, ...args);
            }
        );
    }));
}

function debounceCommand(debounce: number, lastClickTime?: number): boolean {
    if (lastClickTime && lastClickTime + debounce > Date.now()) {
        return true;
    }
    return false;
}
