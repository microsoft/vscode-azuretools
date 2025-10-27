/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { NotSignedInError } from '../utils/NotSignedInError'; // eslint-disable-line @typescript-eslint/no-unused-vars -- It is used in the doc comments
import type { dedupeSubscriptions } from '../utils/dedupeSubscriptions'; // eslint-disable-line @typescript-eslint/no-unused-vars -- It is used in the doc comments
import type { AzureAccount } from './AzureAccount';
import type { AzureSubscription } from './AzureSubscription';
import type { AzureTenant } from './AzureTenant';

/**
 * An interface for obtaining Azure subscription information
 */
export interface AzureSubscriptionProvider {
    /**
     * Fires when the list of available subscriptions may have changed, and a refresh is suggested.
     * @note This will be fired at most every 5 seconds, to avoid flooding.
     */
    onRefreshSuggested: vscode.Event<void>;

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
     * The easier API. Across all accounts and all tenants, returns the list of {@link AzureSubscription}s the user can access.
     * No additional sign-in is performed; unauthenticated tenants will simply be skipped.
     * If you aren't interested in managing multiple accounts or tenant sign ins, this is the only method you need to call.
     * The subscriptions will be deduplicated according to the strategy in {@link dedupeSubscriptions}. If you want a different
     * strategy, you can use {@link getAccounts}, {@link getTenantsForAccount}, and {@link getSubscriptionsForTenant} instead.
     *
     * @param options (Optional) Additional options for getting the subscriptions.
     *
     * @throws A {@link NotSignedInError} if the user is not signed in to any accounts. It will *not* throw if
     * at least one account is signed in, even if no subscriptions are found.
     * @throws A {@link vscode.CancellationError} if the operation is cancelled via the provided cancellation token.
     */
    getAvailableSubscriptions(options?: GetOptions): Promise<AzureSubscription[]>;

    /**
     * Returns a list of all accounts.
     *
     * @param options (Optional) Additional options for getting the accounts.
     *
     * @throws A {@link NotSignedInError} if the user is not signed in to any accounts.
     * @throws A {@link vscode.CancellationError} if the operation is cancelled via the provided cancellation token.
     */
    getAccounts(options?: GetOptions): Promise<AzureAccount[]>;

    /**
     * Returns a list of all unauthenticated tenants for a given account.
     *
     * @param account The account to get unauthenticated tenants for.
     * @param options (Optional) Additional options for getting the tenants.
     *
     * @throws A {@link NotSignedInError} if the user is not signed in to the specified account.
     * @throws A {@link vscode.CancellationError} if the operation is cancelled via the provided cancellation token.
     */
    getUnauthenticatedTenantsForAccount(account: AzureAccount, options?: Omit<GetOptions, 'all'>): Promise<AzureTenant[]>;

    /**
     * Returns a list of tenants for a given account.
     *
     * @param account The account to get tenants for.
     * @param options (Optional) Additional options for getting the tenants.
     *
     * @throws A {@link NotSignedInError} if the user is not signed in to the specified account.
     * @throws A {@link vscode.CancellationError} if the operation is cancelled via the provided cancellation token.
     */
    getTenantsForAccount(account: AzureAccount, options?: GetOptions): Promise<AzureTenant[]>;

    /**
     * Returns a list of {@link AzureSubscription}s for a given tenant and account.
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
    getSubscriptionsForTenant(tenant: TenantIdAndAccount, options?: GetSubscriptionsOptions): Promise<AzureSubscription[]>;
}

/**
 * A type representing just the tenant ID and account information of an Azure tenant.
 */
export type TenantIdAndAccount = Required<Pick<AzureTenant, 'tenantId' | 'account'>>;

/**
 * Options for signing in to a tenant.
 */
export type SignInOptions = {
    /**
     * (Optional, default false) Whether to force the account picker to reappear.
     * Equivalent to setting {@link vscode.AuthenticationGetSessionOptions.clearSessionPreference} to true.
     */
    clearSessionPreference?: boolean;

    /**
     * (Optional, default true) If true, the user will be prompted to sign in if needed.
     * If false, the {@link AzureSubscriptionProvider.signIn} method will return false if
     * interactive sign-in is required.
     */
    promptIfNeeded?: boolean;
};

/**
 * Options for getting items from the {@link AzureSubscriptionProvider}.
 */
export type GetOptions = {
    /**
     * (Optional, default false) Whether to get all items, or only those explicitly selected by the user.
     */
    all?: boolean;

    /**
     * (Optional, default false) Whether to bypass any cached data and refresh from the source.
     *
     * @note In the reference implementation, `VSCodeAzureSubscriptionProvider`, it is NOT necessary to use
     * `noCache: true` in the following cases:
     *     - Subscription filters have changed (caching is done before filtering)
     *     - A new sign-in has occurred (a partial cache refill will occur automatically)
     *
     * It is only necessary to use `noCache: true` if you expect that the subscriptions/tenants that an
     * account has access to have changed--e.g. a subscription is created or removed, or RBAC changes.
     */
    noCache?: boolean;

    /**
     * (Optional) A cancellation token to cancel the operation.
     */
    token?: vscode.CancellationToken;
};

/**
 * Options for getting subscriptions from the {@link AzureSubscriptionProvider}.
 */
export type GetSubscriptionsOptions = GetOptions & {
    /**
     * (Optional, default true) Whether to deduplicate the subscriptions returned, according to the
     * strategy in {@link dedupeSubscriptions}.
     */
    dedupe?: boolean;
};
