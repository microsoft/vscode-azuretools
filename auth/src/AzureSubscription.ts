/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TokenCredential } from '@azure/core-auth';
import type { Environment } from '@azure/ms-rest-azure-env';
import { AzureAuthentication } from './AzureAuthentication';

/**
 * A type representing an Azure subscription ID, in the form `${tenantId}/${subscriptionId}`.
 */
export type SubscriptionId = string;

/**
 * A type representing an Azure tenant ID.
 */
export type TenantId = string;

/**
 * Represents an Azure subscription.
 */
export interface AzureSubscription {
    /**
     * Access to the authentication session associated with this subscription.
     */
    readonly authentication: AzureAuthentication;

    /**
     * The Azure environment to which this subscription belongs.
     */
    readonly environment: Environment;

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
     * The tenant to which this subscription belongs.
     */
    readonly tenantId: TenantId;

    /**
     * The credential for authentication to this subscription. Compatible with Azure track 2 SDKs.
     */
    readonly credential: TokenCredential;
}
