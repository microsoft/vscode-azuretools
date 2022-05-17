/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ApplicationInsightsManagementClient } from '@azure/arm-appinsights';
import type { WebSiteManagementClient } from '@azure/arm-appservice';
import type { ResourceGraphClient } from '@azure/arm-resourcegraph';
import type { ResourceManagementClient } from '@azure/arm-resources';
import { AzExtClientContext, createAzureClient, createAzureSubscriptionClient } from '@microsoft/vscode-azext-azureutils';

// Lazy-load @azure packages to improve startup performance.
// NOTE: The client is the only import that matters, the rest of the types disappear when compiled to JavaScript

export async function createWebSiteClient(context: AzExtClientContext): Promise<WebSiteManagementClient> {
    return createAzureClient(context, (await import('@azure/arm-appservice')).WebSiteManagementClient);
}

export async function createAppInsightsClient(context: AzExtClientContext): Promise<ApplicationInsightsManagementClient> {
    return createAzureClient(context, (await import('@azure/arm-appinsights')).ApplicationInsightsManagementClient);
}

export async function createResourceClient(context: AzExtClientContext): Promise<ResourceManagementClient> {
    return createAzureClient(context, (await import('@azure/arm-resources')).ResourceManagementClient);
}

export async function createResourceGraphClient(context: AzExtClientContext): Promise<ResourceGraphClient> {
    return createAzureSubscriptionClient(context, (await import('@azure/arm-resourcegraph')).ResourceGraphClient);
}
