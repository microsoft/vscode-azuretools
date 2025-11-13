/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { NotSignedInError } from '../utils/NotSignedInError'; // eslint-disable-line @typescript-eslint/no-unused-vars -- It is used in the doc comments
import type { dedupeSubscriptions } from '../utils/dedupeSubscriptions'; // eslint-disable-line @typescript-eslint/no-unused-vars -- It is used in the doc comments
import type { AzureAccount } from './AzureAccount';
import type { AzureSubscription } from './AzureSubscription';
import type { GetAccountsOptions, GetAvailableSubscriptionsOptions, GetSubscriptionsForTenantOptions, GetTenantsForAccountOptions, SignInOptions } from './AzureSubscriptionProviderRequestOptions';
import type { AzureTenant } from './AzureTenant';

/**
 * An interface for obtaining Azure subscription information
 */
export interface AzureSubscriptionProvider {
    /**
     * Fires when the list of available subscriptions may have changed, and a refresh is suggested.
     * The callback will be given a {@link RefreshSuggestedEvent} with more information.
     * @note This will be fired at most every 5 seconds, to avoid flooding. It is also suppressed
     * during operations this provider is performing itself, such as during sign-in.
     */
    onRefreshSuggested: vscode.Event<RefreshSuggestedEvent>;

    /**
     * Signs in to Azure, if not already signed in. This will suppress {@link onRefreshSuggested} events until the sign-in is complete.
     *
     * @param tenant (Optional) If provided, signs in to the specified tenant and account.
     * @param options (Optional) Additional options for signing in.
     *
     * @returns True if sign-in was successful, false otherwise.
     */
    signIn(tenant?: TenantIdAndAccount, options?: SignInOptions): Promise<boolean>;

    /**
     * The easier API. Across all accounts and all tenants*, returns the list of {@link AzureSubscription}s the user can access.
     * No additional automatic sign-in is performed; unauthenticated accounts or tenants will simply be skipped.
     *
     * If you aren't interested in managing multiple accounts or tenant sign ins, this is the only method you need to call.
     *
     * The subscriptions will be deduplicated according to the strategy in {@link dedupeSubscriptions}. If you want a different
     * strategy, you can use request all and deduplicate according to your needs.
     *
     * *The number of tenants processed will be limited to `options.maximumTenants` (default 10),
     * to avoid excessive requests.
     *
     * @param options (Optional) Additional options for getting the subscriptions.
     *
     * @throws A {@link NotSignedInError} if the user is not signed in to any accounts. It will *not* throw if
     * at least one account is signed in, even if no subscriptions are found.
     * @throws A {@link vscode.CancellationError} if the operation is cancelled via the provided cancellation token.
     */
    getAvailableSubscriptions(options?: GetAvailableSubscriptionsOptions): Promise<AzureSubscription[]>;

    /**
     * Returns a list of all accounts. It is up to the caller to get tenants and subscriptions if needed, and the caller
     * is also responsible for limiting the amount of subsequent requests made.
     *
     * @param options (Optional) Additional options for getting the accounts.
     *
     * @throws A {@link NotSignedInError} if the user is not signed in to any accounts.
     * @throws A {@link vscode.CancellationError} if the operation is cancelled via the provided cancellation token.
     */
    getAccounts(options?: GetAccountsOptions): Promise<AzureAccount[]>;

    /**
     * Returns a list of all unauthenticated tenants for a given account.
     *
     * @param account The account to get unauthenticated tenants for.
     * @param options (Optional) Additional options for getting the tenants.
     *
     * @throws A {@link NotSignedInError} if the user is not signed in to the specified account.
     * @throws A {@link vscode.CancellationError} if the operation is cancelled via the provided cancellation token.
     */
    getUnauthenticatedTenantsForAccount(account: AzureAccount, options?: Omit<GetTenantsForAccountOptions, 'all'>): Promise<AzureTenant[]>;

    /**
     * Returns a list of tenants for a given account. It is up to the caller to get subscriptions if needed, and the caller
     * is also responsible for limiting the amount of subsequent requests made.
     *
     * @param account The account to get tenants for.
     * @param options (Optional) Additional options for getting the tenants.
     *
     * @throws A {@link NotSignedInError} if the user is not signed in to the specified account.
     * @throws A {@link vscode.CancellationError} if the operation is cancelled via the provided cancellation token.
     */
    getTenantsForAccount(account: AzureAccount, options?: GetTenantsForAccountOptions): Promise<AzureTenant[]>;

    /**
     * Returns a list of {@link AzureSubscription}s for a given tenant and account. The caller is responsible for
     * limiting the amount of subsequent requests made.
     *
     * @example
     * ```typescript
     * const accounts = await subscriptionProvider.getAccounts();
     * for (const account of accounts) {
     *     const tenants = await subscriptionProvider.getTenantsForAccount(account);
     *     for (const tenant of tenants) {
     *         const subscriptions = await subscriptionProvider.getSubscriptionsForTenant(tenant);
     *         // do something with subscriptions
     *     }
     * }
     * ```
     *
     * @param tenant The tenant (and account) to get subscriptions for.
     * @param options (Optional) Additional options for getting the subscriptions.
     *
     * @throws A {@link NotSignedInError} if the user is not signed in to the specified account *and* tenant.
     * @throws A {@link vscode.CancellationError} if the operation is cancelled via the provided cancellation token.
     */
    getSubscriptionsForTenant(tenant: TenantIdAndAccount, options?: GetSubscriptionsForTenantOptions): Promise<AzureSubscription[]>;
}

/**
 * A type representing just the tenant ID and account information of an Azure tenant.
 */
export type TenantIdAndAccount = Required<Pick<AzureTenant, 'tenantId' | 'account'>>;

/**
 * Information included when a refresh is suggested.
 */
export interface RefreshSuggestedEvent {
    /**
     * The reason a refresh was suggested.
     */
    reason: 'sessionChange' | 'subscriptionFilterChange';
}
