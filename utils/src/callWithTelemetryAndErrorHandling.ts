/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, MessageItem, window } from 'vscode';
import * as types from '../index';
import { DialogResponses } from './DialogResponses';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { getRedactedLabel, maskUserInfo } from './masking';
import { parseError } from './parseError';
import { cacheIssueForCommand } from './registerReportIssueCommand';
import { IReportableIssue, reportAnIssue } from './reportAnIssue';
import { AzExtUserInput } from './userInput/AzExtUserInput';
import { limitLines } from './utils/textStrings';

const maxStackLines: number = 3;

function initContext(callbackId: string): [number, types.IActionContext] {
    const start: number = Date.now();
    const context: types.IActionContext = {
        telemetry: {
            properties: {
                isActivationEvent: 'false',
                lastStep: '',
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
        },
        ui: <AzExtUserInput><unknown>undefined,
        valuesToMask: []
    };
    context.ui = new AzExtUserInput(context);

    const handlerContext: types.IHandlerContext = Object.assign(context, { callbackId });
    for (const handler of Object.values(onActionStartHandlers)) {
        try {
            handler(handlerContext);
        } catch {
            // don't block other handlers
        }
    }

    return [start, context];
}

export function callWithTelemetryAndErrorHandlingSync<T>(callbackId: string, callback: (context: types.IActionContext) => T): T | undefined {
    const [start, context] = initContext(callbackId);

    try {
        return callback(context);
    } catch (error) {
        handleError(context, callbackId, error);
        return undefined;
    } finally {
        handleTelemetry(context, callbackId, start);
    }
}

export async function callWithTelemetryAndErrorHandling<T>(callbackId: string, callback: (context: types.IActionContext) => T | PromiseLike<T>): Promise<T | undefined> {
    const [start, context] = initContext(callbackId);

    try {
        return await Promise.resolve(callback(context));
    } catch (error) {
        handleError(context, callbackId, error);
        return undefined;
    } finally {
        handleTelemetry(context, callbackId, start);
    }
}

const onActionStartHandlers: { [id: number]: types.OnActionStartHandler } = {};
const errorHandlers: { [id: number]: types.ErrorHandler } = {};
const telemetryHandlers: { [id: number]: types.TelemetryHandler } = {};

export function registerOnActionStartHandler(handler: types.OnActionStartHandler): Disposable {
    return registerHandler(handler, onActionStartHandlers);
}

export function registerErrorHandler(handler: types.ErrorHandler): Disposable {
    return registerHandler(handler, errorHandlers);
}

export function registerTelemetryHandler(handler: types.TelemetryHandler): Disposable {
    return registerHandler(handler, telemetryHandlers);
}

let handlerCount: number = 0;
function registerHandler<T>(handler: T, handlers: { [id: string]: T }): Disposable {
    handlerCount += 1;
    const id: number = handlerCount;
    handlers[id] = handler;
    return {
        dispose: (): void => {
            delete handlers[id];
        }
    };
}

function handleError(context: types.IActionContext, callbackId: string, error: unknown): void {
    let rethrow: boolean = false;
    const errorContext: types.IErrorHandlerContext = Object.assign(context, { error, callbackId });
    try {
        for (const handler of Object.values(errorHandlers)) {
            try {
                handler(errorContext);
            } catch {
                // don't block other handlers
            }
        }

        const errorData: types.IParsedError = parseError(errorContext.error);
        const unMaskedMessage: string = errorData.message;
        errorData.message = maskUserInfo(errorData.message, context.valuesToMask);
        if (errorData.stepName) {
            context.telemetry.properties.lastStep = errorData.stepName;
        }

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

        const issue: IReportableIssue = {
            callbackId: errorContext.callbackId,
            error: errorData,
            issueProperties: context.errorHandling.issueProperties,
            time: Date.now()
        };

        if (!context.errorHandling.suppressDisplay || context.errorHandling.forceIncludeInReportIssueCommand) {
            cacheIssueForCommand(issue);
        }

        if (!context.errorHandling.suppressDisplay) {
            // Always append the error to the output channel, but only 'show' the output channel for multiline errors
            ext.outputChannel.appendLog(localize('outputError', 'Error: {0}', unMaskedMessage));

            let message: string;
            if (unMaskedMessage.includes('\n')) {
                ext.outputChannel.show();
                message = localize('multilineError', 'An error has occured. Check output window for more details.');
            } else {
                message = unMaskedMessage;
            }

            const items: MessageItem[] = [];
            if (!context.errorHandling.suppressReportIssue) {
                items.push(DialogResponses.reportAnIssue);
            }

            if (context.errorHandling.buttons) {
                items.push(...context.errorHandling.buttons);
            }

            // don't wait
            void window.showErrorMessage(message, ...items).then(async (result: MessageItem | types.AzExtErrorButton | undefined) => {
                if (result === DialogResponses.reportAnIssue) {
                    await reportAnIssue(issue);
                } else if (result && 'callback' in result) {
                    await result.callback();
                }
            });
        }

        if (context.errorHandling.rethrow) {
            rethrow = true;
            throw errorContext.error;
        }
    } catch (internalError) {
        if (rethrow) {
            // Only time an error is expected is in the `rethrow` case
            throw internalError;
        } else {
            sendHandlerFailedEvent(errorContext, 'error');
        }
    }
}

function handleTelemetry(context: types.IActionContext, callbackId: string, start: number): void {
    const handlerContext: types.IHandlerContext = Object.assign(context, { callbackId });
    try {
        for (const handler of Object.values(telemetryHandlers)) {
            try {
                handler(handlerContext);
            } catch {
                // don't block other handlers
            }
        }

        if (shouldSendTelemtry(context)) {
            const end: number = Date.now();
            context.telemetry.measurements.duration = (end - start) / 1000;
            // de-dupe
            context.valuesToMask = context.valuesToMask.filter((v, index) => context.valuesToMask.indexOf(v) === index);
            for (const [key, value] of Object.entries(context.telemetry.properties)) {
                if (value) {
                    if (/(error|exception)/i.test(key)) {
                        context.telemetry.properties[key] = context.telemetry.maskEntireErrorMessage ? getRedactedLabel('action') : maskUserInfo(value, context.valuesToMask);
                    } else {
                        context.telemetry.properties[key] = maskUserInfo(value, context.valuesToMask, true /* lessAggressive */);
                    }
                }
            }

            // TODO: https://github.com/microsoft/vscode-azuretools/issues/1176
            // const errorProps: string[] = Object.keys(context.telemetry.properties).filter(key => /(error|exception|stack)/i.test(key));
            // Note: The id of the extension is automatically prepended to the given callbackId (e.g. "vscode-cosmosdb/")
            ext._internalReporter.sendTelemetryErrorEvent(getTelemetryEventName(handlerContext), context.telemetry.properties, context.telemetry.measurements, []);
        }
    } catch {
        sendHandlerFailedEvent(handlerContext, 'telemetry');
    }
}

function shouldSendTelemtry(context: types.IActionContext): boolean {
    return !context.telemetry.suppressAll && !(context.telemetry.suppressIfSuccessful && context.telemetry.properties.result === 'Succeeded');
}

function sendHandlerFailedEvent(context: types.IHandlerContext, handlerName: string) {
    // Errors in our handler logic should not be shown to the user
    try {
        if (shouldSendTelemtry(context)) {
            // Try to send a simple event that should at least alert us that there's a problem
            ext._internalReporter.sendTelemetryErrorEvent(getTelemetryEventName(context), { handlerFailed: handlerName });
        }
    } catch {
        // something must be really wrong with telemetry. just give up
    }
}

function getTelemetryEventName(context: types.IHandlerContext): string {
    return context.telemetry.eventVersion ? `${context.callbackId}V${context.telemetry.eventVersion}` : context.callbackId;
}
