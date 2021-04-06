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
    if (wizardContext.isCustomCloud) {
        return <StorageManagementClient><unknown>createAzureClient(wizardContext, (await import('@azure/arm-storage-profile-2020-09-01-hybrid')).StorageManagementClient);
    } else {
        return createAzureClient(wizardContext, (await import('@azure/arm-storage')).StorageManagementClient);
    }
}

export async function createResourcesClient<T extends types.IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceManagementClient> {
    if (wizardContext.isCustomCloud) {
        return <ResourceManagementClient><unknown>createAzureClient(wizardContext, (await import('@azure/arm-resources-profile-2020-09-01-hybrid')).ResourceManagementClient);
    } else {
        return createAzureClient(wizardContext, (await import('@azure/arm-resources')).ResourceManagementClient);
    }
}

export async function createSubscriptionsClient<T extends types.ISubscriptionWizardContext>(wizardContext: T): Promise<SubscriptionClient> {
    return createAzureSubscriptionClient(wizardContext, (await import('@azure/arm-subscriptions')).SubscriptionClient);
}
