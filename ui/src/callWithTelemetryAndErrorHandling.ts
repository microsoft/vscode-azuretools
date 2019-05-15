/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, window } from 'vscode';
import { IActionContext } from '../index';
import { IParsedError } from '../index';
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
        suppressTelemetry: false,
        suppressErrorDisplay: false,
        rethrowError: false
    };
    return [start, context];
}

export function callWithTelemetryAndErrorHandlingSync<T>(callbackId: string, callback: (this: IActionContext) => T): T | undefined {
    const [start, context] = initContext();

    try {
        return <T>callback.call(context);
    } catch (error) {
        handleError(context, callbackId, error);
        return undefined;
    } finally {
        handleTelemetry(context, callbackId, start);
    }
}

export async function callWithTelemetryAndErrorHandling<T>(callbackId: string, callback: (this: IActionContext) => T | PromiseLike<T>): Promise<T | undefined> {
    const [start, context] = initContext();

    try {
        return await <Promise<T>>Promise.resolve(callback.call(context));
    } catch (error) {
        handleError(context, callbackId, error);
        return undefined;
    } finally {
        handleTelemetry(context, callbackId, start);
    }
}

function handleError(context: IActionContext, callbackId: string, error: unknown): void {
    const errorData: IParsedError = parseError(error);
    if (errorData.isUserCancelledError) {
        context.properties.result = 'Canceled';
        context.suppressErrorDisplay = true;
        context.rethrowError = false;
    } else {
        context.properties.result = 'Failed';
        context.properties.error = errorData.errorType;
        context.properties.errorMessage = errorData.message;
        context.properties.stack = errorData.stack ? limitLines(errorData.stack, maxStackLines) : undefined;
        if (context.suppressTelemetry) {
            context.properties.suppressTelemetry = 'true';
        }
    }

    if (!context.suppressErrorDisplay) {
        // Always append the error to the output channel, but only 'show' the output channel for multiline errors
        ext.outputChannel.appendLine(localize('outputError', 'Error: {0}', errorData.message));

        let message: string;
        if (errorData.message.includes('\n')) {
            ext.outputChannel.show();
            message = localize('multilineError', 'An error has occured. Check output window for more details.');
        } else {
            message = errorData.message;
        }

        // don't wait
        window.showErrorMessage(message, DialogResponses.reportAnIssue).then(async (result: MessageItem | undefined) => {
            if (result === DialogResponses.reportAnIssue) {
                await reportAnIssue(callbackId, errorData);
            }
        });
    }

    if (context.rethrowError) {
        throw error;
    }
}

function handleTelemetry(context: IActionContext, callbackId: string, start: number): void {
    // For suppressTelemetry=true, ignore successful results
    if (!(context.suppressTelemetry && context.properties.result === 'Succeeded')) {
        const end: number = Date.now();
        context.measurements.duration = (end - start) / 1000;

        // Note: The id of the extension is automatically prepended to the given callbackId (e.g. "vscode-cosmosdb/")
        ext.reporter.sendTelemetryEvent(callbackId, context.properties, context.measurements);
    }
}
