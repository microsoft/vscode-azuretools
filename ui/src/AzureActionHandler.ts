/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, Event, Uri } from 'vscode';
import { IActionContext } from '../index';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { ext } from './extensionVariables';
import { AzureTreeItem } from './treeDataProvider/AzureTreeItem';

// tslint:disable:no-any no-unsafe-any
export function registerCommand(commandId: string, callback: (this: IActionContext, ...args: any[]) => any, debounce?: number): void {
    let lastClickTime: number; /* Used for debounce */
    ext.context.subscriptions.push(commands.registerCommand(commandId, async (...args: any[]): Promise<any> => {
        return await callWithTelemetryAndErrorHandling(
            commandId,
            function (this: IActionContext): any {
                if (args.length > 0) {
                    const contextArg: any = args[0];

                    if (contextArg instanceof AzureTreeItem) {
                        this.properties.contextValue = contextArg.contextValue;
                    } else if (contextArg instanceof Uri) {
                        this.properties.contextValue = 'Uri';
                    }
                }

                // tslint:disable-next-line:strict-boolean-expressions
                if (debounce) { /* Only check for debounce if registered command specifies */
                    if (debounceCommand(debounce, lastClickTime)) {
                        return;
                    }
                    lastClickTime = Date.now();
                }
                return callback.call(this, ...args);
            }
        );
    }));
}

export function registerEvent<T>(eventId: string, event: Event<T>, callback: (this: IActionContext, ...args: any[]) => any): void {
    ext.context.subscriptions.push(event(async (...args: any[]): Promise<any> => {
        return await callWithTelemetryAndErrorHandling(
            eventId,
            function (this: IActionContext): any {
                return callback.call(this, ...args);
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
