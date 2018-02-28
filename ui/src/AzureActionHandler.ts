/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, Event, ExtensionContext, OutputChannel, window } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { IActionContext } from '../index';
import { IParsedError } from '../index';
import { localize } from './localize';
import { parseError } from './parseError';

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

    public static async callWithTelemetry(callbackId: string, telemetryReporter: TelemetryReporter | undefined, callback: (this: IActionContext) => any): Promise<any> {
        return await AzureActionHandler.callWithTelemetryAndErrorHandling(callbackId, telemetryReporter, undefined, function (this: IActionContext): any {
            this.displayError = false;
            this.swallowError = false;
            return callback.call(this);
        });
    }

    public static async callWithTelemetryAndErrorHandling(callbackId: string, telemetryReporter: TelemetryReporter | undefined, outputChannel: OutputChannel | undefined, callback: (this: IActionContext) => any): Promise<any> {
        const start: number = Date.now();
        const context: IActionContext = {
            properties: {},
            measurements: {},
            sendTelemetry: true,
            displayError: true,
            swallowError: true
        };
        context.properties.result = 'Succeeded';

        try {
            return await Promise.resolve(callback.call(context));
        } catch (error) {
            const errorData: IParsedError = parseError(error);
            if (errorData.isUserCancelledError) {
                context.properties.result = 'Canceled';
                context.displayError = false;
                context.swallowError = true;
            } else {
                context.properties.result = 'Failed';
                context.properties.error = errorData.errorType;
                context.properties.errorMessage = errorData.message;
            }

            if (context.displayError && outputChannel) {
                // Always append the error to the output channel, but only 'show' the output channel for multiline errors
                outputChannel.appendLine(localize('outputError', 'Error: {0}', errorData.message));
                if (errorData.message.includes('\n')) {
                    outputChannel.show();
                    window.showErrorMessage(localize('multilineError', 'An error has occured. Check output window for more details.'));
                } else {
                    window.showErrorMessage(errorData.message);
                }
            }

            if (!context.swallowError) {
                throw error;
            }
        } finally {
            if (telemetryReporter && context.sendTelemetry) {
                const end: number = Date.now();
                context.measurements.duration = (end - start) / 1000;
                telemetryReporter.sendTelemetryEvent(callbackId, context.properties, context.measurements);
            }
        }
    }

    public registerCommand(commandId: string, callback: (this: IActionContext, ...args: any[]) => any): void {
        this._extensionContext.subscriptions.push(commands.registerCommand(commandId, async (...args: any[]): Promise<any> => {
            return await AzureActionHandler.callWithTelemetryAndErrorHandling(commandId, this._telemetryReporter, this._outputChannel, function (this: IActionContext): any {
                return callback.call(this, ...args);
            });
        }));
    }

    public registerEvent<T>(eventId: string, event: Event<T>, callback: (this: IActionContext, ...args: any[]) => any): void {
        this._extensionContext.subscriptions.push(event(async (...args: any[]): Promise<any> => {
            return await AzureActionHandler.callWithTelemetryAndErrorHandling(eventId, this._telemetryReporter, this._outputChannel, function (this: IActionContext): any {
                return callback.call(this, ...args);
            });
        }));
    }
}
