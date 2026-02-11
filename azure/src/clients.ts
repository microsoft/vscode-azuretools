/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AuthorizationManagementClient as AMC } from '@azure/arm-authorization';
import type { AuthorizationManagementClient as PAMC } from '@azure/arm-authorization-profile-2020-09-01-hybrid';
import type { ManagedServiceIdentityClient } from '@azure/arm-msi';
import type { ResourceManagementClient as RMC } from '@azure/arm-resources';
import type { ResourceManagementClient as PRMC } from '@azure/arm-resources-profile-2020-09-01-hybrid';
import type { SubscriptionClient } from '@azure/arm-resources-subscriptions';
import type { StorageManagementClient as SMC } from '@azure/arm-storage';
import type { StorageManagementClient as PSMC } from '@azure/arm-storage-profile-2020-09-01-hybrid';
import type { AzExtClientType } from '../index';
import { createAzureClient, createAzureSubscriptionClient, InternalAzExtClientContext, parseClientContext } from './createAzureClient';

export type CommonAuthorizationManagementClient = AMC | PAMC;
export type CommonResourcesClient = RMC | PRMC;
export type CommonStorageManagementClient = SMC | PSMC;

// Lazy-load @azure packages to improve startup performance.
// NOTE: The client is the only import that matters, the rest of the types disappear when compiled to JavaScript

export async function createStorageClient(context: InternalAzExtClientContext): Promise<CommonStorageManagementClient> {
    if (parseClientContext(context).isCustomCloud) {
        return createAzureClient(context, (await import('@azure/arm-storage-profile-2020-09-01-hybrid')).StorageManagementClient);
    } else {
        return createAzureClient(context, (await import('@azure/arm-storage')).StorageManagementClient as unknown as AzExtClientType<SMC>);
    }
}

export async function createResourcesClient(context: InternalAzExtClientContext): Promise<CommonResourcesClient> {
    if (parseClientContext(context).isCustomCloud) {
        return createAzureClient(context, (await import('@azure/arm-resources-profile-2020-09-01-hybrid')).ResourceManagementClient);
    } else {
        return createAzureClient(context, (await import('@azure/arm-resources')).ResourceManagementClient);
    }
}

export async function createManagedServiceIdentityClient(context: InternalAzExtClientContext): Promise<ManagedServiceIdentityClient> {
    return createAzureClient(context, (await import('@azure/arm-msi')).ManagedServiceIdentityClient as unknown as AzExtClientType<ManagedServiceIdentityClient>);
}

export async function createAuthorizationManagementClient(context: InternalAzExtClientContext): Promise<CommonAuthorizationManagementClient> {
    if (parseClientContext(context).isCustomCloud) {
        return createAzureClient(context, (await import('@azure/arm-authorization-profile-2020-09-01-hybrid')).AuthorizationManagementClient);
    } else {
        return createAzureClient(context, (await import('@azure/arm-authorization')).AuthorizationManagementClient);
    }
}

export function isProfileAuthorizationManagementClient(client: CommonAuthorizationManagementClient): client is PAMC {
    return !('listForSubscription' in client.roleAssignments);
}

export async function createSubscriptionsClient(context: InternalAzExtClientContext): Promise<SubscriptionClient> {
    return createAzureSubscriptionClient(context, (await import('@azure/arm-resources-subscriptions')).SubscriptionClient);
}
