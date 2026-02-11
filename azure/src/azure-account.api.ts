/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Subscription } from '@azure/arm-resources-subscriptions';
import type { TokenCredential } from '@azure/core-auth';
import type { Environment } from '@azure/ms-rest-azure-env';
import type { ReadStream } from 'fs';
import type { CancellationToken, Event, Progress, Terminal } from 'vscode';

/**
 * @deprecated The Azure Account extension is deprecated.
 */
export type AzureLoginStatus = 'Initializing' | 'LoggingIn' | 'LoggedIn' | 'LoggedOut';

/**
 * @deprecated The Azure Account extension is deprecated.
 */
export interface AzureAccountExtensionApi {
    readonly apiVersion: string;
    readonly status: AzureLoginStatus;
    readonly filters: AzureResourceFilter[];
    readonly sessions: AzureSession[];
    readonly subscriptions: AzureSubscription[];
    readonly onStatusChanged: Event<AzureLoginStatus>;
    readonly onFiltersChanged: Event<void>;
    readonly onSessionsChanged: Event<void>;
    readonly onSubscriptionsChanged: Event<void>;
    readonly waitForFilters: () => Promise<boolean>;
    readonly waitForLogin: () => Promise<boolean>;
    readonly waitForSubscriptions: () => Promise<boolean>;
    createCloudShell(os: 'Linux' | 'Windows'): CloudShell;
}

/**
 * @deprecated The Azure Account extension is deprecated.
 */
export interface AzureSession {
    readonly environment: Environment;
    readonly userId: string;
    readonly tenantId: string;

    /**
     * The credentials object for azure-sdk-for-js modules https://github.com/azure/azure-sdk-for-js
     */
    readonly credentials2: TokenCredential;
}

/**
 * @deprecated The Azure Account extension is deprecated.
 */
export interface AzureSubscription {
    readonly session: AzureSession;
    readonly subscription: Subscription;
}

/**
 * @deprecated The Azure Account extension is deprecated.
 */
export type AzureResourceFilter = AzureSubscription;

/**
 * @deprecated The Azure Account extension is deprecated.
 */
export type CloudShellStatus = 'Connecting' | 'Connected' | 'Disconnected';

/**
 * @deprecated The Azure Account extension is deprecated.
 */
export interface UploadOptions {
    contentLength?: number;
    progress?: Progress<{ message?: string; increment?: number }>;
    token?: CancellationToken;
}

/**
 * @deprecated The Azure Account extension is deprecated.
 */
export interface CloudShell {
    readonly status: CloudShellStatus;
    readonly onStatusChanged: Event<CloudShellStatus>;
    readonly waitForConnection: () => Promise<boolean>;
    readonly terminal: Promise<Terminal>;
    readonly session: Promise<AzureSession>;
    readonly uploadFile: (filename: string, stream: ReadStream, options?: UploadOptions) => Promise<void>;
}
