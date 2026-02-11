/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AuthorizationManagementClient } from '@azure/arm-authorization';
import type { ManagedServiceIdentityClient } from '@azure/arm-msi';
import type { ResourceManagementClient } from '@azure/arm-resources';
import type { SubscriptionClient } from '@azure/arm-resources-subscriptions';
import type { StorageManagementClient } from '@azure/arm-storage';
import type { AzExtClientType } from '../index';
import { createAzureClient, createAzureSubscriptionClient, InternalAzExtClientContext, parseClientContext } from './createAzureClient';

// Lazy-load @azure packages to improve startup performance.
// NOTE: The client is the only import that matters, the rest of the types disappear when compiled to JavaScript

export async function createStorageClient(context: InternalAzExtClientContext): Promise<StorageManagementClient> {
    if (parseClientContext(context).isCustomCloud) {
        return <StorageManagementClient><unknown>createAzureClient(context, (await import('@azure/arm-storage-profile-2020-09-01-hybrid')).StorageManagementClient);
    } else {
        return createAzureClient(context, (await import('@azure/arm-storage')).StorageManagementClient as unknown as AzExtClientType<StorageManagementClient>);
    }
}

export async function createResourcesClient(context: InternalAzExtClientContext): Promise<ResourceManagementClient> {
    if (parseClientContext(context).isCustomCloud) {
        return <ResourceManagementClient><unknown>createAzureClient(context, (await import('@azure/arm-resources-profile-2020-09-01-hybrid')).ResourceManagementClient);
    } else {
        return createAzureClient(context, (await import('@azure/arm-resources')).ResourceManagementClient);
    }
}

export async function createManagedServiceIdentityClient(context: InternalAzExtClientContext): Promise<ManagedServiceIdentityClient> {
    return createAzureClient(context, (await import('@azure/arm-msi')).ManagedServiceIdentityClient as unknown as AzExtClientType<ManagedServiceIdentityClient>);
}

export async function createAuthorizationManagementClient(context: InternalAzExtClientContext): Promise<AuthorizationManagementClient> {
    if (parseClientContext(context).isCustomCloud) {
        return <AuthorizationManagementClient><unknown>createAzureClient(context, (await import('@azure/arm-authorization-profile-2020-09-01-hybrid')).AuthorizationManagementClient);
    } else {
        return createAzureClient(context, (await import('@azure/arm-authorization')).AuthorizationManagementClient);
    }
}

export async function createSubscriptionsClient(context: InternalAzExtClientContext): Promise<SubscriptionClient> {
    return createAzureSubscriptionClient(context, (await import('@azure/arm-resources-subscriptions')).SubscriptionClient);
}
