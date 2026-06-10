/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzureSubscriptionProvider as NextAzureSubscriptionProvider } from '../next/contracts/AzureSubscriptionProvider';
import type { GetAccountsOptions, GetAvailableSubscriptionsOptions, GetSubscriptionsForTenantOptions, GetTenantsForAccountOptions, SignInOptions } from '../next/contracts/AzureSubscriptionProviderRequestOptions';
import type { AzureAccount } from './AzureAccount';
import type { AzureSubscription } from './AzureSubscription';
import type { AzureTenant } from './AzureTenant';

export type { RefreshSuggestedEvent } from '../next/contracts/AzureSubscriptionProvider';

/**
 * A type representing just the tenant ID and account information of an Azure tenant.
 */
export type TenantIdAndAccount = Required<Pick<AzureTenant, 'tenantId' | 'account'>>;

/**
 * An interface for obtaining Azure subscription information.
 *
 * @remarks Identical to the `./next` {@link NextAzureSubscriptionProvider}, except every listing method
 * returns the legacy {@link AzureSubscription}/{@link AzureAccount}/{@link AzureTenant} types, which expose
 * a per-subscription `authentication` and a concrete `@azure/ms-rest-azure-env` environment.
 */
export interface AzureSubscriptionProvider extends NextAzureSubscriptionProvider {
    /**
     * @inheritdoc
     *
     * @remarks Redeclared so the `tenant` parameter uses the legacy {@link TenantIdAndAccount} (which carries
     * the legacy {@link AzureAccount}) rather than inheriting the `./next` signature.
     */
    signIn(tenant?: TenantIdAndAccount, options?: SignInOptions): Promise<boolean>;

    /**
     * @inheritdoc
     */
    getAvailableSubscriptions(options?: GetAvailableSubscriptionsOptions): Promise<AzureSubscription[]>;

    /**
     * @inheritdoc
     */
    getAccounts(options?: GetAccountsOptions): Promise<AzureAccount[]>;

    /**
     * @inheritdoc
     */
    getUnauthenticatedTenantsForAccount(account: AzureAccount, options?: Omit<GetTenantsForAccountOptions, 'filter'>): Promise<AzureTenant[]>;

    /**
     * @inheritdoc
     */
    getTenantsForAccount(account: AzureAccount, options?: GetTenantsForAccountOptions): Promise<AzureTenant[]>;

    /**
     * @inheritdoc
     */
    getSubscriptionsForTenant(tenant: TenantIdAndAccount, options?: GetSubscriptionsForTenantOptions): Promise<AzureSubscription[]>;
}