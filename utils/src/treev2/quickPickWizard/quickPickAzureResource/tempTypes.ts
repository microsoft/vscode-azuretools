/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationResource, ApplicationSubscription } from '../../../../hostapi.v2';
import * as types from '../../../../index';

// TODO: THIS FILE IS TEMPORARY //
// It needs to be replaced by real Resources extension interfaces //

// These are assumptions made about the nodes in the tree

export type SubscriptionItem = ResourceGroupsItem & {
    subscription: ApplicationSubscription;
}

export type GroupingItem = ResourceGroupsItem & {
    resourceType?: types.AzExtResourceType
}

export type AppResourceItem = ResourceGroupsItem & {
    resource: ApplicationResource;
};

export type ResourceGroupsItem = unknown;
