/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Environment } from '@azure/ms-rest-azure-env';
import type { AzureSubscription as NextAzureSubscription } from '../next/contracts/AzureSubscription';
import type { AzureAccount } from './AzureAccount';
import type { AzureAuthentication } from './AzureAuthentication';

export type { SubscriptionId, TenantId } from '../next/contracts/AzureSubscription';

/**
 * Represents an Azure subscription.
 *
 * @remarks Extends the `./next` {@link NextAzureSubscription} with the legacy {@link authentication} member,
 * a concrete `@azure/ms-rest-azure-env` {@link Environment}, and the legacy {@link AzureAccount}.
 */
export interface AzureSubscription extends Omit<NextAzureSubscription, 'environment' | 'account'> {
    /**
     * Access to the authentication session associated with this subscription.
     */
    readonly authentication: AzureAuthentication;

    /**
     * The Azure environment to which this subscription belongs.
     */
    readonly environment: Environment;

    /**
     * The account associated with this subscription.
     */
    readonly account: AzureAccount;
}