/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from '@azure/arm-resources';
import { StorageManagementClient } from '@azure/arm-storage';
import { SubscriptionClient } from '@azure/arm-subscriptions';
import { createAzureClient, createAzureSubscriptionClient, InternalAzExtClientContext, parseClientContext } from './createAzureClient';

// Lazy-load @azure packages to improve startup performance.
// NOTE: The client is the only import that matters, the rest of the types disappear when compiled to JavaScript

export async function createStorageClient(context: InternalAzExtClientContext): Promise<StorageManagementClient> {
    if (parseClientContext(context).isCustomCloud) {
        return <StorageManagementClient><unknown>createAzureClient(context, (await import('@azure/arm-storage-profile-2020-09-01-hybrid')).StorageManagementClient);
    } else {
        return createAzureClient(context, (await import('@azure/arm-storage')).StorageManagementClient);
    }
}

export async function createResourcesClient(context: InternalAzExtClientContext): Promise<ResourceManagementClient> {
    if (parseClientContext(context).isCustomCloud) {
        return <ResourceManagementClient><unknown>createAzureClient(context, (await import('@azure/arm-resources-profile-2020-09-01-hybrid')).ResourceManagementClient);
    } else {
        return createAzureClient(context, (await import('@azure/arm-resources')).ResourceManagementClient);
    }
}

export async function createSubscriptionsClient(context: InternalAzExtClientContext): Promise<SubscriptionClient> {
    return createAzureSubscriptionClient(context, (await import('@azure/arm-subscriptions')).SubscriptionClient);
}
