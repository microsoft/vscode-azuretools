/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TokenCredential } from '@azure/core-auth';
import type { AzureAccount } from './AzureAccount';
import type { EnvironmentLike } from './EnvironmentLike';

/**
 * A type representing an Azure subscription ID, not including the tenant ID.
 */
export type SubscriptionId = Readonly<string>;

/**
 * A type representing an Azure tenant ID.
 */
export type TenantId = Readonly<string>;

/**
 * Represents an Azure subscription.
 *
 * @remarks Unlike the legacy `.` entrypoint, this type does not expose an `authentication` member. All
 * authentication is performed through the {@link credential}.
 */
export interface AzureSubscription {
    /**
     * The Azure environment to which this subscription belongs.
     */
    readonly environment: EnvironmentLike;

    /**
     * Whether this subscription belongs to a custom cloud.
     */
    readonly isCustomCloud: boolean;

    /**
     * The display name of this subscription.
     */
    readonly name: string;

    /**
     * The ID of this subscription.
     */
    readonly subscriptionId: SubscriptionId;

    /**
     * The ID of the tenant to which this subscription belongs.
     */
    readonly tenantId: TenantId;

    /**
     * The credential for authentication to this subscription. Compatible with Azure track 2 SDKs.
     */
    readonly credential: TokenCredential;

    /**
     * The account associated with this subscription.
     */
    readonly account: AzureAccount;
}
