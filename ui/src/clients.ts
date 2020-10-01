/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from '@azure/arm-resources';
import { StorageManagementClient } from '@azure/arm-storage';
import { SubscriptionClient } from '@azure/arm-subscriptions';
import * as types from '../index';
import { createAzureClient, createAzureSubscriptionClient } from './createAzureClient';

// Lazy-load @azure packages to improve startup performance.
// NOTE: The client is the only import that matters, the rest of the types disappear when compiled to JavaScript

export async function createStorageClient<T extends types.IStorageAccountWizardContext>(wizardContext: T): Promise<StorageManagementClient> {
    return createAzureClient(wizardContext, (await import('@azure/arm-storage')).StorageManagementClient);
}

export async function createResourcesClient<T extends types.IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceManagementClient> {
    return createAzureClient(wizardContext, (await import('@azure/arm-resources')).ResourceManagementClient);
}

export async function createSubscriptionsClient<T extends types.ISubscriptionWizardContext>(wizardContext: T): Promise<SubscriptionClient> {
    return createAzureSubscriptionClient(wizardContext, (await import('@azure/arm-subscriptions')).SubscriptionClient);
}
