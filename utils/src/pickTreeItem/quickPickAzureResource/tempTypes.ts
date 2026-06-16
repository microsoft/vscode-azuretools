/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzExtResourceType, AzureResource, AzureSubscription } from '@microsoft/vscode-azureresources-api';

// TODO: THIS FILE IS TEMPORARY //
// It needs to be replaced by real Resources extension interfaces //

// These are assumptions made about the nodes in the tree

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- intentional: these temporary types intersect with ResourceGroupsItem to mirror the real Resources extension interfaces
export type SubscriptionItem = ResourceGroupsItem & {
    subscription: AzureSubscription;
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- intentional: these temporary types intersect with ResourceGroupsItem to mirror the real Resources extension interfaces
export type GroupingItem = ResourceGroupsItem & {
    resourceType?: AzExtResourceType
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- intentional: these temporary types intersect with ResourceGroupsItem to mirror the real Resources extension interfaces
export type AzureResourceItem = ResourceGroupsItem & {
    resource: AzureResource;
};

export type ResourceGroupsItem = unknown;
