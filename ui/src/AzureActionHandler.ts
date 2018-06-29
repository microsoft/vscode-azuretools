/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, Event } from 'vscode';
import { IActionContext } from '../index';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { ext } from './extensionVariables';
import { AzureNode } from './treeDataProvider/AzureNode';

// tslint:disable:no-any no-unsafe-any

export function registerCommand(commandId: string, callback: (this: IActionContext, ...args: any[]) => any): void {
    ext.context.subscriptions.push(commands.registerCommand(commandId, async (...args: any[]): Promise<any> => {
        return await callWithTelemetryAndErrorHandling(
            commandId,
            function (this: IActionContext): any {
                if (args.length > 0 && args[0] instanceof AzureNode) {
                    const node: AzureNode = <AzureNode>args[0];
                    this.properties.contextValue = node.treeItem.contextValue;
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
