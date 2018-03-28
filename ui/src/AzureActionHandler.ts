/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, Event, ExtensionContext, OutputChannel } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { IActionContext } from '../index';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { AzureNode } from './treeDataProvider/AzureNode';

// tslint:disable:no-any no-unsafe-any

export class AzureActionHandler {
    private _extensionContext: ExtensionContext;
    private _outputChannel: OutputChannel;
    private _telemetryReporter: TelemetryReporter | undefined;
    public constructor(extensionContext: ExtensionContext, outputChannel: OutputChannel, telemetryReporter?: TelemetryReporter) {
        this._extensionContext = extensionContext;
        this._outputChannel = outputChannel;
        this._telemetryReporter = telemetryReporter;
    }

    public registerCommand(commandId: string, callback: (this: IActionContext, ...args: any[]) => any): void {
        this._extensionContext.subscriptions.push(commands.registerCommand(commandId, async (...args: any[]): Promise<any> => {
            return await callWithTelemetryAndErrorHandling(
                commandId,
                this._telemetryReporter,
                this._outputChannel,
                function (this: IActionContext): any {
                    if (args.length > 0 && args[0] instanceof AzureNode) {
                        const node: AzureNode = <AzureNode>args[0];
                        this.properties.contextValue = node.treeItem.contextValue;
                    }

                    return callback.call(this, ...args);
                },
                this._extensionContext
            );
        }));
    }

    public registerEvent<T>(eventId: string, event: Event<T>, callback: (this: IActionContext, ...args: any[]) => any): void {
        this._extensionContext.subscriptions.push(event(async (...args: any[]): Promise<any> => {
            return await callWithTelemetryAndErrorHandling(
                eventId,
                this._telemetryReporter,
                this._outputChannel,
                function (this: IActionContext): any {
                    return callback.call(this, ...args);
                },
                this._extensionContext
            );
        }));
    }
}
