/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, l10n, MessageItem, TelemetryTrustedValue, window } from 'vscode';
import type { IActionContext, IHandlerContext, OnActionStartHandler, ErrorHandler, TelemetryHandler, IErrorHandlerContext, AzExtErrorButton } from './types/actionContext';
import type { IParsedError } from './types/extension';
import { DialogResponses } from './DialogResponses';
import { ext } from './extensionVariables';
import { getRedactedLabel, maskUserInfo } from './masking';
import { parseError } from './parseError';
import { cacheIssueForCommand } from './registerReportIssueCommand';
import { IReportableIssue, reportAnIssue } from './reportAnIssue';
import { AzExtUserInput } from './userInput/AzExtUserInput';
import { limitLines } from './utils/textStrings';

const maxStackLines: number = 3;

function initContext(callbackId: string): [number, IActionContext] {
    const start: number = Date.now();
    const context: IActionContext = {
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

    const handlerContext: IHandlerContext = Object.assign(context, { callbackId });
    for (const handler of Object.values(onActionStartHandlers)) {
        try {
            handler(handlerContext);
        } catch {
            // don't block other handlers
        }
    }

    return [start, context];
}

/**
 * NOTE: If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then telemetry will not be sent. If the value is 'verbose' or 'v', telemetry will be displayed in the console window.
 */
export function callWithTelemetryAndErrorHandlingSync<T>(callbackId: string, callback: (context: IActionContext) => T): T | undefined {
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

/**
 * NOTE: If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then telemetry will not be sent. If the value is 'verbose' or 'v', telemetry will be displayed in the console window.
 */
export async function callWithTelemetryAndErrorHandling<T>(callbackId: string, callback: (context: IActionContext) => T | PromiseLike<T>): Promise<T | undefined> {
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

const onActionStartHandlers: { [id: number]: OnActionStartHandler } = {};
const errorHandlers: { [id: number]: ErrorHandler } = {};
const telemetryHandlers: { [id: number]: TelemetryHandler } = {};

/**
 * Register a handler to run right after an `IActionContext` is created and before the action starts
 * NOTE: If more than one handler is registered, they are run in an arbitrary order.
 */
export function registerOnActionStartHandler(handler: OnActionStartHandler): Disposable {
    return registerHandler(handler, onActionStartHandlers);
}

/**
 * Register a handler to run after a callback errors out, but before the default error handling.
 * NOTE: If more than one handler is registered, they are run in an arbitrary order.
 */
export function registerErrorHandler(handler: ErrorHandler): Disposable {
    return registerHandler(handler, errorHandlers);
}

/**
 * Register a handler to run after a callback finishes, but before the default telemetry handling.
 * NOTE: If more than one handler is registered, they are run in an arbitrary order.
 */
export function registerTelemetryHandler(handler: TelemetryHandler): Disposable {
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

function handleError(context: IActionContext, callbackId: string, error: unknown): void {
    let rethrow: boolean = false;
    const errorContext: IErrorHandlerContext = Object.assign(context, { error, callbackId });
    try {
        for (const handler of Object.values(errorHandlers)) {
            try {
                handler(errorContext);
            } catch {
                // don't block other handlers
            }
        }

        // The original error data
        const unMaskedErrorData: IParsedError = parseError(errorContext.error);

        // A copy of the error data after masking private user information as much as possible
        const maskedErrorMessage = maskUserInfo(unMaskedErrorData.message, context.valuesToMask);

        if (unMaskedErrorData.stepName) {
            context.telemetry.properties.lastStep = unMaskedErrorData.stepName;
        }

        if (unMaskedErrorData.isUserCancelledError) {
            context.telemetry.properties.result = 'Canceled';
            context.errorHandling.suppressDisplay = true;
            context.errorHandling.rethrow = false;
        } else {
            context.telemetry.properties.result = 'Failed';
            context.telemetry.properties.error = unMaskedErrorData.errorType;

            /**
             * @param errorMessage
             * @deprecated
             * Continue to emit telemetry for clients who are still using this property. You should suppress this property if you need to migrate to the new replacement.
             *
             * @param errorMessageV2
             * A duplicate replacement of the `errorMessage` telemetry property which should be used instead.
             */
            context.telemetry.properties.errorMessage = maskedErrorMessage;
            context.telemetry.properties.errorMessageV2 = maskedErrorMessage;

            context.telemetry.properties.stack = unMaskedErrorData.stack ? limitLines(unMaskedErrorData.stack, maxStackLines) : undefined;
            if (context.telemetry.suppressIfSuccessful || context.telemetry.suppressAll) {
                context.telemetry.properties.suppressTelemetry = 'true';
            }
        }

        const issue: IReportableIssue = {
            callbackId: errorContext.callbackId,
            error: unMaskedErrorData,
            issueProperties: context.errorHandling.issueProperties,
            time: Date.now()
        };

        if (!context.errorHandling.suppressDisplay || context.errorHandling.forceIncludeInReportIssueCommand) {
            cacheIssueForCommand(issue);
        }

        if (!context.errorHandling.suppressDisplay) {
            // Always append the error to the output channel, but only 'show' the output channel for multiline errors
            ext.outputChannel.appendLog(l10n.t('Error: {0}', unMaskedErrorData.message));

            let notificationMessage: string;
            if (unMaskedErrorData.message.includes('\n')) {
                ext.outputChannel.show();
                notificationMessage = l10n.t('An error has occurred. Check output window for more details.');
            } else {
                notificationMessage = unMaskedErrorData.message;
            }

            const items: MessageItem[] = [];
            if (!context.errorHandling.suppressReportIssue) {
                items.push(DialogResponses.reportAnIssue);
            }

            if (context.errorHandling.buttons) {
                items.push(...context.errorHandling.buttons);
            }

            // don't wait
            void window.showErrorMessage(notificationMessage, ...items).then(async (result: MessageItem | AzExtErrorButton | undefined) => {
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

function handleTelemetry(context: IActionContext, callbackId: string, start: number): void {
    const handlerContext: IHandlerContext = Object.assign(context, { callbackId });
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
                    } else if (value instanceof TelemetryTrustedValue) {
                        // don't mask trusted values
                    } else {
                        context.telemetry.properties[key] = maskUserInfo(value, context.valuesToMask, true /* lessAggressive */);
                    }
                }
            }

            // Note: The id of the extension is automatically prepended to the given callbackId (e.g. "vscode-cosmosdb/")
            ext._internalReporter.sendTelemetryErrorEvent(getTelemetryEventName(handlerContext), context.telemetry.properties, context.telemetry.measurements);
        }
    } catch {
        sendHandlerFailedEvent(handlerContext, 'telemetry');
    }
}

function shouldSendTelemtry(context: IActionContext): boolean {
    return !context.telemetry.suppressAll && !(context.telemetry.suppressIfSuccessful && context.telemetry.properties.result === 'Succeeded');
}

function sendHandlerFailedEvent(context: IHandlerContext, handlerName: string) {
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

function getTelemetryEventName(context: IHandlerContext): string {
    return context.telemetry.eventVersion ? `${context.callbackId}V${context.telemetry.eventVersion}` : context.callbackId;
}
