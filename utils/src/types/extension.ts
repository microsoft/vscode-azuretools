/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ExtensionContext, LogOutputChannel, OutputChannel } from 'vscode';
import type { AzureExtensionApi, GetApiOptions } from '@microsoft/vscode-azureresources-api';

export interface IParsedError extends Error {
    errorType: string;
    message: string;
    stack?: string;
    stepName?: string;
    isUserCancelledError: boolean;
}

/**
 * Wrapper for vscode.OutputChannel that handles AzureExtension behavior for outputting messages
 */
export interface IAzExtOutputChannel extends OutputChannel {

    /**
     * appendLog adds the current timestamps to all messages
     * @param value The message to be printed
     * @param options.resourceName The name of the resource. If provided, the resource name will be prefixed to the message
     * @param options.date The date to prepend before the message, otherwise it defaults to Date.now()
     */
    appendLog(value: string, options?: { resourceName?: string, date?: Date }): void;
}

export type IAzExtLogOutputChannel = IAzExtOutputChannel & LogOutputChannel;

/**
 * Interface for common extension variables used throughout the UI package.
 */
export interface UIExtensionVariables {
    context: ExtensionContext;
    outputChannel: IAzExtOutputChannel;

    /**
     * Set to true if not running under a webpacked 'dist' folder
     */
    ignoreBundle?: boolean;
}

/**
 * Interface for experimentation service adapter
 */
export interface IExperimentationServiceAdapter {
    /**
     * Gets whether or not the flight is enabled from the cache (which will be ~1 session delayed)
     * @param flight The flight variable name
     */
    isCachedFlightEnabled(flight: string): Promise<boolean>;

    /**
     * Gets whether or not the flight is enabled directly from the web. This is slower than cache and can result in behavior changing mid-session.
     * @param flight The flight variable name
     */
    isLiveFlightEnabled(flight: string): Promise<boolean>;

    /**
     * Gets a treatment variable from the cache (which will be ~1 session delayed)
     * @param name The variable name
     */
    getCachedTreatmentVariable<T extends string | number | boolean>(name: string): Promise<T | undefined>;

    /**
     * Gets a treatment variable directly from the web. This is slower than cache and can result in behavior changing mid-session.
     * @param name The variable name
     */
    getLiveTreatmentVariable<T extends string | number | boolean>(name: string): Promise<T | undefined>;
}

export interface IAddUserAgent {
    addUserAgentInfo(additionalUserAgentInfo: any): void;
}

export type AzureExtensionApiFactory<T extends AzureExtensionApi = AzureExtensionApi> = {
    apiVersion: string,
    createApi: (options?: GetApiOptions) => T
};
