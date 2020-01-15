/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, window } from 'vscode';
import { IActionContext, IParsedError } from '../index';
import { DialogResponses } from './DialogResponses';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { parseError } from './parseError';
import { reportAnIssue } from './reportAnIssue';
import { limitLines } from './utils/textStrings';

const maxStackLines: number = 3;

function initContext(): [number, IActionContext] {
    const start: number = Date.now();
    const context: IActionContext = {
        telemetry: {
            properties: {
                isActivationEvent: 'false',
                cancelStep: '',
                result: 'Succeeded',
                stack: '',
                error: '',
                errorMessage: ''
            },
            measurements: {
                duration: 0
            },
            suppressIfSuccessful: false,
            suppressAll: false
        },
        errorHandling: {
            suppressDisplay: false,
            rethrow: false,
            issueProperties: {}
        }
    };
    return [start, context];
}

export function callWithTelemetryAndErrorHandlingSync<T>(callbackId: string, callback: (context: IActionContext) => T): T | undefined {
    const [start, context] = initContext();

    try {
        return callback(context);
    } catch (error) {
        handleError(context, callbackId, error);
        return undefined;
    } finally {
        handleTelemetry(context, callbackId, start);
    }
}

export async function callWithTelemetryAndErrorHandling<T>(callbackId: string, callback: (context: IActionContext) => T | PromiseLike<T>): Promise<T | undefined> {
    const [start, context] = initContext();

    try {
        return await Promise.resolve(callback(context));
    } catch (error) {
        handleError(context, callbackId, error);
        return undefined;
    } finally {
        handleTelemetry(context, callbackId, start);
    }
}

function handleError(context: IActionContext, callbackId: string, error: unknown): void {
    const errorData: IParsedError = parseError(error);
    context = { ...context, ...errorData.actionContext };

    if (errorData.isUserCancelledError) {
        context.telemetry.properties.result = 'Canceled';
        context.errorHandling.suppressDisplay = true;
        context.errorHandling.rethrow = false;
    } else {
        context.telemetry.properties.result = 'Failed';
        context.telemetry.properties.error = errorData.errorType;
        context.telemetry.properties.errorMessage = errorData.message;
        context.telemetry.properties.stack = errorData.stack ? limitLines(errorData.stack, maxStackLines) : undefined;
        if (context.telemetry.suppressIfSuccessful || context.telemetry.suppressAll) {
            context.telemetry.properties.suppressTelemetry = 'true';
        }
    }

    if (!context.errorHandling.suppressDisplay) {
        // Always append the error to the output channel, but only 'show' the output channel for multiline errors
        ext.outputChannel.appendLog(localize('outputError', 'Error: {0}', errorData.message));

        let message: string;
        if (errorData.message.includes('\n')) {
            ext.outputChannel.show();
            message = localize('multilineError', 'An error has occured. Check output window for more details.');
        } else {
            message = errorData.message;
        }

        const items: MessageItem[] = [];

        if (!context.errorHandling.suppressReportIssue) {
            items.push(DialogResponses.reportAnIssue);
        }

        // don't wait
        window.showErrorMessage(message, ...items).then(async (result: MessageItem | undefined) => {
            if (result === DialogResponses.reportAnIssue) {
                await reportAnIssue(callbackId, errorData, context.errorHandling.issueProperties);
            }
        });
    }

    if (context.errorHandling.rethrow) {
        throw error;
    }
}

function handleTelemetry(context: IActionContext, callbackId: string, start: number): void {
    if (!context.telemetry.suppressAll && !(context.telemetry.suppressIfSuccessful && context.telemetry.properties.result === 'Succeeded')) {
        const end: number = Date.now();
        context.telemetry.measurements.duration = (end - start) / 1000;

        // Note: The id of the extension is automatically prepended to the given callbackId (e.g. "vscode-cosmosdb/")
        ext.reporter.sendTelemetryEvent(callbackId, context.telemetry.properties, context.telemetry.measurements);
    }
}
