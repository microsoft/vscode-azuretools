/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzExtResourceType, AzureResource, AzureSubscription } from '@microsoft/vscode-azureresources-api';

// TODO: THIS FILE IS TEMPORARY //
// It needs to be replaced by real Resources extension interfaces //

// These are assumptions made about the nodes in the tree

export type SubscriptionItem = ResourceGroupsItem & {
    subscription: AzureSubscription;
}

export type GroupingItem = ResourceGroupsItem & {
    resourceType?: AzExtResourceType
}

export type AzureResourceItem = ResourceGroupsItem & {
    resource: AzureResource;
};

export type ResourceGroupsItem = unknown;
