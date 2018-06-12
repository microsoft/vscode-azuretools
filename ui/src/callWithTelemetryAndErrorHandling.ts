/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, MessageItem, OutputChannel, window } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { IActionContext } from '../index';
import { IParsedError } from '../index';
import { DialogResponses } from './DialogResponses';
import { localize } from './localize';
import { parseError } from './parseError';
import { reportAnIssue } from './reportAnIssue';

// tslint:disable-next-line:no-any
export async function callWithTelemetryAndErrorHandling(callbackId: string, telemetryReporter: TelemetryReporter | undefined, outputChannel: OutputChannel | undefined, callback: (this: IActionContext) => any, extensionContext?: ExtensionContext): Promise<any> {
    const start: number = Date.now();
    const context: IActionContext = {
        properties: {
            isActivationEvent: 'false',
            cancelStep: '',
            result: 'Succeeded',
            error: '',
            errorMessage: ''
        },
        measurements: {
            duration: 0
        },
        suppressTelemetry: false,
        suppressErrorDisplay: false,
        rethrowError: false
    };

    try {
        return await Promise.resolve(callback.call(context));
    } catch (error) {
        const errorData: IParsedError = parseError(error);
        if (errorData.isUserCancelledError) {
            context.properties.result = 'Canceled';
            context.suppressErrorDisplay = true;
            context.rethrowError = false;
        } else {
            context.properties.result = 'Failed';
            context.properties.error = errorData.errorType;
            context.properties.errorMessage = errorData.message;
        }

        if (!context.suppressErrorDisplay && outputChannel) {
            // Always append the error to the output channel, but only 'show' the output channel for multiline errors
            outputChannel.appendLine(localize('outputError', 'Error: {0}', errorData.message));

            let result: MessageItem | undefined;
            if (errorData.message.includes('\n')) {
                outputChannel.show();
                result = await window.showErrorMessage(localize('multilineError', 'An error has occured. Check output window for more details.'), DialogResponses.reportAnIssue);
            } else {
                result = await window.showErrorMessage(errorData.message, DialogResponses.reportAnIssue);
            }

            if (result === DialogResponses.reportAnIssue) {
                reportAnIssue(callbackId, errorData, extensionContext);
            }
        }

        if (context.rethrowError) {
            throw error;
        }
    } finally {
        if (telemetryReporter) {
            // For suppressTelemetry=true, ignore successful results
            if (!(context.suppressTelemetry && context.properties.result === 'Succeeded')) {
                const end: number = Date.now();
                context.measurements.duration = (end - start) / 1000;

                // Note: The id of the extension is automatically prepended to the given callbackId (e.g. "vscode-cosmosdb/")
                telemetryReporter.sendTelemetryEvent(callbackId, context.properties, context.measurements);
            }
        }
    }
}
