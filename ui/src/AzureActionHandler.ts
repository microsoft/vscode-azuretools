/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, Event, ExtensionContext, OutputChannel, window } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { TelemetryMeasurements, TelemetryProperties } from '../index';
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

    public registerCommand(commandId: string, callback: (...args: any[]) => any): void {
        this.registerCommandWithCustomTelemetry(commandId, (_properties: TelemetryProperties, _measurements: TelemetryMeasurements, ...args: any[]) => callback(...args));
    }

    public registerCommandWithCustomTelemetry(commandId: string, callback: (properties: TelemetryProperties, measurements: TelemetryMeasurements, ...args: any[]) => any): void {
        this._extensionContext.subscriptions.push(commands.registerCommand(commandId, this.wrapCallback(commandId, (trackTelemetry: () => void, properties: TelemetryProperties, measurements: TelemetryMeasurements, ...args: any[]) => {
            trackTelemetry(); // Always track telemetry for commands
            return callback(properties, measurements, ...args);
        })));
    }

    public registerEvent<T>(eventId: string, event: Event<T>, callback: (trackTelemetry: () => void, ...args: any[]) => any): void {
        this.registerEventWithCustomTelemetry<T>(eventId, event, (trackTelemetry: () => void, _properties: TelemetryProperties, _measurements: TelemetryMeasurements, ...args: any[]) => callback(trackTelemetry, ...args));
    }

    public registerEventWithCustomTelemetry<T>(eventId: string, event: Event<T>, callback: (trackTelemetry: () => void, properties: TelemetryProperties, measurements: TelemetryMeasurements, ...args: any[]) => any): void {
        this._extensionContext.subscriptions.push(event(this.wrapCallback(eventId, callback)));
    }

    public async callWithTelemetry(callbackId: string, callback: (properties: TelemetryProperties, measurements: TelemetryMeasurements) => any): Promise<any> {
        return await this.callWithTelemetryInternal(callbackId, (trackTelemetry: () => void, properties: TelemetryProperties, measurements: TelemetryMeasurements) => {
            trackTelemetry();
            return callback(properties, measurements);
        });
    }

    private wrapCallback(callbackId: string, callback: (trackTelemetry: () => void, properties: TelemetryProperties, measurements: TelemetryMeasurements, ...args: any[]) => any): (...args: any[]) => Promise<any> {
        return async (...args: any[]): Promise<any> => {
            try {
                return await this.callWithTelemetryInternal(callbackId, (trackTelemetry: () => void, properties: TelemetryProperties, measurements: TelemetryMeasurements) => {
                    return callback(trackTelemetry, properties, measurements, ...args);
                });
            } catch (error) {
                const errorData: IParsedError = parseError(error);
                if (!errorData.isUserCancelledError) {
                    // Always append the error to the output channel, but only 'show' the output channel for multiline errors
                    this._outputChannel.appendLine(localize('outputError', 'Error: {0}', errorData.message));
                    if (errorData.message.includes('\n')) {
                        this._outputChannel.show();
                        window.showErrorMessage(localize('multilineError', 'An error has occured. Check output window for more details.'));
                    } else {
                        window.showErrorMessage(errorData.message);
                    }
                }

                return undefined;
            }
        };
    }

    private async callWithTelemetryInternal(callbackId: string, callback: (trackTelemetry: () => void, properties: TelemetryProperties, measurements: TelemetryMeasurements) => any): Promise<any> {
        const start: number = Date.now();
        const properties: TelemetryProperties = {};
        const measurements: TelemetryMeasurements = {};
        properties.result = 'Succeeded';
        let sendTelemetry: boolean = false;

        try {
            return await Promise.resolve(callback(() => { sendTelemetry = true; }, properties, measurements));
        } catch (error) {
            const errorData: IParsedError = parseError(error);
            if (errorData.isUserCancelledError) {
                properties.result = 'Canceled';
            } else {
                properties.result = 'Failed';
                properties.error = errorData.errorType;
                properties.errorMessage = errorData.message;
            }

            throw error;
        } finally {
            if (this._telemetryReporter && sendTelemetry) {
                const end: number = Date.now();
                measurements.duration = (end - start) / 1000;
                this._telemetryReporter.sendTelemetryEvent(callbackId, properties, measurements);
            }
        }
    }
}
