/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { MessageItem, TelemetryTrustedValue } from 'vscode';
import type { IAzureUserInput } from './userInput';

export type CommandCallback = (context: IActionContext, ...args: any[]) => any;

/**
 * A generic context object that describes the behavior of an action and allows for specifying custom telemetry properties and measurements
 * You may also extend this object if you need to pass along custom properties through things like a wizard or tree item picker
 */
export interface IActionContext {
    /**
     * The id for the callback, used as the id for the telemetry event.
     */
    callbackId?: string;

    /**
     * Describes the behavior of telemetry for this action
     */
    telemetry: ITelemetryContext;

    /**
     * Describes the behavior of error handling for this action
     */
    errorHandling: IErrorHandlingContext;

    /**
     * Custom implementation of common methods that handle user input (as opposed to using `vscode.window`)
     * Provides additional functionality to support wizards, grouping, 'recently used', telemetry, etc.
     * For more information, see the docs on each method and on each `options` object
     */
    ui: IAzureUserInput;

    /**
     * Add a value to mask for this action
     * This will apply to telemetry and "Report Issue", but _not_ VS Code UI (i.e. the error notification or output channel)
     * IMPORTANT: For the most sensitive information, `callWithMaskHandling` should be used instead
     */
    valuesToMask: string[];
}

export interface ITelemetryContext {
    /**
     * Custom properties that will be included in telemetry
     */
    properties: TelemetryProperties;

    /**
     * Custom measurements that will be included in telemetry
     */
    measurements: TelemetryMeasurements;

    /**
     * Defaults to `false`. If true, successful events are suppressed from telemetry, but cancel and error events are still sent.
     */
    suppressIfSuccessful?: boolean;

    /**
     * Defaults to `false`. If true, all events are suppressed from telemetry.
     */
    suppressAll?: boolean;

    /**
     * If true, any error message for this event will not be tracked in telemetry
     */
    maskEntireErrorMessage?: boolean;

    /**
     * Will be appended to the end of the telemetry event name if specified. This is typically used when the original event has been suppressed/retired for some reason
     */
    eventVersion?: number;
}

export interface AzExtErrorButton extends MessageItem {
    /**
     * To be called if the button is clicked
     */
    callback: () => Promise<void>;
}

export interface IErrorHandlingContext {
    /**
     * Defaults to `false`. If true, does not display this error to the user and does not include it in the "Report Issue" command.
     */
    suppressDisplay?: boolean;

    /**
     * Defaults to `false`. If true, re-throws error outside the context of this action.
     */
    rethrow?: boolean;

    /**
     * Defaults to `false`. If true, does not show the "Report Issue" button in the error notification.
     */
    suppressReportIssue?: boolean;

    /**
     * Defaults to `false`. If true, this error will be included in the "Report Issue" command regardless of `suppressDisplay`
     */
    forceIncludeInReportIssueCommand?: boolean;

    /**
     * Additional buttons to include in error notification besides "Report an Issue"
     */
    buttons?: AzExtErrorButton[];

    /**
     * Custom properties that will be included in any error reports generated during this action
     */
    issueProperties: { [key: string]: string | undefined };
}

export interface TelemetryProperties {
    /**
     * If applicable, it is the id of the resource that is being acted upon.
     */
    resourceId?: TelemetryTrustedValue<string>;
    /**
     * If applicable, it is the id of the subscription of the resource that is being acted upon.
     */
    subscriptionId?: string;
    /**
     * Defaults to `false`
     * This is used to more accurately track usage, since activation events generally shouldn't 'count' as usage
     */
    isActivationEvent?: 'true' | 'false';
    isCopilotEvent?: 'true' | 'false';
    result?: 'Succeeded' | 'Failed' | 'Canceled';
    error?: string;
    errorMessage?: string;

    /**
     * @deprecated Specify a stepName in the constructor of `UserCancelledError` or on `AzExtUserInputOptions` instead
     */
    cancelStep?: string;

    /**
     * The last step attempted regardless of the result of the action. Will be automatically set in most cases
     */
    lastStep?: string;

    [key: string]: string | TelemetryTrustedValue<string> | undefined;
}

export interface TelemetryMeasurements {
    duration?: number;
    [key: string]: number | undefined;
}

export interface IHandlerContext extends IActionContext {
    /**
     * The id for the callback, used as the id for the telemetry event. This may be modified by any handler
     */
    callbackId: string;
}

export interface IErrorHandlerContext extends IHandlerContext {
    /**
     * The error to be handled. This may be modified by any handler
     */
    error: unknown;
}

export type ErrorHandler = (context: IErrorHandlerContext) => void;

export type TelemetryHandler = (context: IHandlerContext) => void;

export type OnActionStartHandler = (context: IHandlerContext) => void;

export type TreeNodeCommandCallback<T> = (context: IActionContext, node?: T, nodes?: T[], ...args: any[]) => unknown;
