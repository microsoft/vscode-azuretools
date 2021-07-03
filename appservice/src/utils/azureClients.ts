/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsManagementClient } from '@azure/arm-appinsights';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import { ResourceManagementClient } from '@azure/arm-resources';
import { createAzureClient, createAzureSubscriptionClient, ISubscriptionContext } from 'vscode-azureextensionui';

// Lazy-load @azure packages to improve startup performance.
// NOTE: The client is the only import that matters, the rest of the types disappear when compiled to JavaScript

export async function createWebSiteClient<T extends ISubscriptionContext>(context: T): Promise<WebSiteManagementClient> {
    return createAzureClient(context, (await import('@azure/arm-appservice')).WebSiteManagementClient);
}

export async function createAppInsightsClient<T extends ISubscriptionContext>(context: T): Promise<ApplicationInsightsManagementClient> {
    return createAzureClient(context, (await import('@azure/arm-appinsights')).ApplicationInsightsManagementClient);
}

export async function createResourceClient<T extends ISubscriptionContext>(context: T): Promise<ResourceManagementClient> {
    return createAzureClient(context, (await import('@azure/arm-resources')).ResourceManagementClient);
}

export async function createResourceGraphClient<T extends ISubscriptionContext>(context: T): Promise<ResourceGraphClient> {
    return createAzureSubscriptionClient(context, (await import('@azure/arm-resourcegraph')).ResourceGraphClient);
}
