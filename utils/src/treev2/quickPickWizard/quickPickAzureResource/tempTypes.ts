/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceGroupsItem } from '../../../../hostapi.v2';
import * as types from '../../../../index';

// TODO: THIS FILE IS TEMPORARY //
// It needs to be replaced by real Resources extension interfaces //

export type SubscriptionItem = ResourceGroupsItem & {
    subscription: ApplicationSubscription;
};

export type GroupingItem = ResourceGroupsItem & {
    resourceType?: types.AzExtResourceType
}

export type AppResourceItem = ResourceGroupsItem & ApplicationResource;

type ResourceBase = {};

/**
 * Represents an individual resource in Azure.
 * @remarks The `id` property is expected to be the Azure resource ID.
 */
export interface ApplicationResource extends ResourceBase {
    readonly subscription: ApplicationSubscription;
    readonly azExtResourceType?: types.AzExtResourceType;
    readonly resourceGroup?: string;
}

export type ApplicationSubscription = unknown;
