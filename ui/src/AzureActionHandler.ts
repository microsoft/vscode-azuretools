/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, Event, Uri } from 'vscode';
import { IActionContext } from '../index';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { ext } from './extensionVariables';
import { AzExtTreeItem } from './treeDataProvider/AzExtTreeItem';

// tslint:disable:no-any no-unsafe-any
export function registerCommand(commandId: string, callback: (context: IActionContext, ...args: any[]) => any, debounce?: number): void {
    let lastClickTime: number | undefined; /* Used for debounce */
    ext.context.subscriptions.push(commands.registerCommand(commandId, async (...args: any[]): Promise<any> => {
        // tslint:disable-next-line:strict-boolean-expressions
        if (debounce) { /* Only check for debounce if registered command specifies */
            if (debounceCommand(debounce, lastClickTime)) {
                return;
            }
            lastClickTime = Date.now();
        }
        return await callWithTelemetryAndErrorHandling(
            commandId,
            (context: IActionContext) => {
                if (args.length > 0) {
                    const firstArg: any = args[0];

                    if (firstArg instanceof AzExtTreeItem) {
                        context.telemetry.properties.contextValue = firstArg.effectiveContextValue;
                    } else if (firstArg instanceof Uri) {
                        context.telemetry.properties.contextValue = 'Uri';
                    }
                }

                return callback(context, ...args);
            }
        );
    }));
}

export function registerEvent<T>(eventId: string, event: Event<T>, callback: (context: IActionContext, ...args: any[]) => any): void {
    ext.context.subscriptions.push(event(async (...args: any[]): Promise<any> => {
        return await callWithTelemetryAndErrorHandling(
            eventId,
            (context: IActionContext) => {
                return callback(context, ...args);
            }
        );
    }));
}

function debounceCommand(debounce: number, lastClickTime?: number): boolean {
    // tslint:disable-next-line:strict-boolean-expressions
    if (lastClickTime && lastClickTime + debounce > Date.now()) {
        return true;
    }
    return false;
}
