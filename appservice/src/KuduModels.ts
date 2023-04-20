/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */

// #region Adapted from https://github.com/microsoft/vscode-azuretools/blob/edeeefbc939e76745be104e9663d3ffb8681810f/kudu/src/models/index.ts

/**
 * An interface representing DeployResult.
 */
export interface DeployResult {
    id?: string;
    status?: number;
    statusText?: string;
    authorEmail?: string;
    author?: string;
    deployer?: string;
    message?: string;
    progress?: string;
    receivedTime?: Date;
    startTime?: Date;
    endTime?: Date;
    lastSuccessEndTime?: Date;
    complete?: boolean;
    active?: boolean;
    isTemp?: boolean;
    isReadonly?: boolean;
    url?: string;
    logUrl?: string;
    siteName?: string;
}

/**
 * An interface representing LogEntry.
 */
export interface LogEntry {
    logTime?: Date;
    id?: string;
    message?: string;
    type?: number;
    detailsUrl?: string;
}

/**
 * Optional Parameters.
 */
export interface PushDeploymentZipPushDeployOptionalParams extends /*msRest.*/RequestOptionsBase {
    isAsync?: boolean;
    author?: string;
    authorEmail?: string;
    deployer?: string;
    message?: string;
    trackDeploymentId?: boolean;
}

/**
 * Optional Parameters.
 */
export interface PushDeploymentWarPushDeployOptionalParams extends /*msRest.*/RequestOptionsBase {
    isAsync?: boolean;
    author?: string;
    authorEmail?: string;
    deployer?: string;
    message?: string;
}

// #endregion Adapted from https://github.com/microsoft/vscode-azuretools/blob/edeeefbc939e76745be104e9663d3ffb8681810f/kudu/src/models/index.ts

// #region Adapted from https://github.com/Azure/ms-rest-js/blob/3b57cdf3f4133dfed1396d0781fabb3ed4e1fb71/lib/webResource.ts

/**
 * Allows the request to be aborted upon firing of the "abort" event.
 * Compatible with the browser built-in AbortSignal and common polyfills.
 */
export interface AbortSignalLike {
    readonly aborted: boolean;
    dispatchEvent: (event: Event) => boolean;
    onabort: ((this: AbortSignalLike, ev: Event) => any) | null;
    addEventListener: (
        type: "abort",
        listener: (this: AbortSignalLike, ev: Event) => any,
        options?: any
    ) => void;
    removeEventListener: (
        type: "abort",
        listener: (this: AbortSignalLike, ev: Event) => any,
        options?: any
    ) => void;
}

/**
 * Describes the base structure of the options object that will be used in every operation.
 */
export interface RequestOptionsBase {
    /**
     * @property {object} [customHeaders] User defined custom request headers that
     * will be applied before the request is sent.
     */
    customHeaders?: { [key: string]: string };

    /**
     * The signal which can be used to abort requests.
     */
    abortSignal?: AbortSignalLike;

    /**
     * The number of milliseconds a request can take before automatically being terminated.
     */
    timeout?: number;

    /**
     * Callback which fires upon upload progress.
     */
    onUploadProgress?: (progress: TransferProgressEvent) => void;

    /**
     * Callback which fires upon download progress.
     */
    onDownloadProgress?: (progress: TransferProgressEvent) => void;

    [key: string]: any;
}

/**
 * Fired in response to upload or download progress.
 */
export type TransferProgressEvent = {
    /**
     * The number of bytes loaded so far.
     */
    loadedBytes: number;
};

// #endregion Adapted from https://github.com/Azure/ms-rest-js/blob/3b57cdf3f4133dfed1396d0781fabb3ed4e1fb71/lib/webResource.ts
