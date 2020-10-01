/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Environment } from '@azure/ms-rest-azure-env';
import { ServiceClient, ServiceClientCredentials } from '@azure/ms-rest-js';
import * as vscode from "vscode";
import * as types from '../index';
import { appendExtensionUserAgent } from "./extensionUserAgent";

export function createAzureClient<T>(
    clientInfo: { credentials: ServiceClientCredentials; subscriptionId: string; environment: Environment; },
    clientType: new (credentials: ServiceClientCredentials, subscriptionId: string, options?: types.IMinimumServiceClientOptions) => T): T {
    return new clientType(clientInfo.credentials, clientInfo.subscriptionId, {
        acceptLanguage: vscode.env.language,
        baseUri: clientInfo.environment.resourceManagerEndpointUrl,
        userAgent: appendExtensionUserAgent
    });
}

export function createAzureSubscriptionClient<T>(
    clientInfo: { credentials: ServiceClientCredentials; environment: Environment; },
    clientType: new (credentials: ServiceClientCredentials, options?: types.IMinimumServiceClientOptions) => T): T {
    return new clientType(clientInfo.credentials, {
        acceptLanguage: vscode.env.language,
        baseUri: clientInfo.environment.resourceManagerEndpointUrl,
        userAgent: appendExtensionUserAgent
    });
}

export async function createGenericClient(clientInfo?: ServiceClientCredentials | { credentials: ServiceClientCredentials; environment: Environment; }): Promise<ServiceClient> {
    let credentials: ServiceClientCredentials | undefined;
    let baseUri: string | undefined;
    if (clientInfo && 'credentials' in clientInfo) {
        credentials = clientInfo.credentials;
        baseUri = clientInfo.environment.resourceManagerEndpointUrl;
    } else {
        credentials = clientInfo;
    }

    const gsc: typeof import('./GenericServiceClient') = await import('./GenericServiceClient');

    return new gsc.GenericServiceClient(credentials, <types.IMinimumServiceClientOptions>{
        baseUri,
        userAgent: appendExtensionUserAgent
    });
}
