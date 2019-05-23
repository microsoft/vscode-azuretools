/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EnvironmentParameters  } from "@azure/ms-rest-azure-env";
import { AzureServiceClientOptions } from "@azure/ms-rest-azure-js";
import { ServiceClientCredentials } from "@azure/ms-rest-js";
import { appendExtensionUserAgent } from "./appendExtensionUserAgent";

export function createAzureClient<T>(
    clientInfo: { credentials: ServiceClientCredentials; subscriptionId: string; environment: EnvironmentParameters; },
    clientType: new (credentials: ServiceClientCredentials, subscriptionId: string, options?: AzureServiceClientOptions & {baseUri: string}) => T): T {
    return new clientType(clientInfo.credentials, clientInfo.subscriptionId, {baseUri: clientInfo.environment.resourceManagerEndpointUrl, userAgent: appendExtensionUserAgent});
}

export function createAzureSubscriptionClient<T>(
    clientInfo: { credentials: ServiceClientCredentials; environment: EnvironmentParameters; },
    clientType: new (credentials: ServiceClientCredentials, options?: AzureServiceClientOptions & {baseUri: string}) => T): T {
    return new clientType(clientInfo.credentials, {baseUri: clientInfo.environment.resourceManagerEndpointUrl, userAgent: appendExtensionUserAgent});
    }
