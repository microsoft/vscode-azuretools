/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';

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
 * Default options for signing in to a tenant
 */
export const DefaultSignInOptions = {
    clearSessionPreference: false,
    promptIfNeeded: true,
} as const satisfies SignInOptions;

/**
 * Options for getting items from the subscription provider
 * @note - As needed, remember to update the {@link getCoalescenceKey} function when modifying this type.
 */
export type BaseOptions = {
    /**
     * (Optional, default true) If true, only items explicitly selected by the user will be returned.
     */
    filter?: boolean;

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
 * Options when requesting accounts
 */
export type GetAccountsOptions = BaseOptions;

/**
 * Options when requesting tenants for an account
 */
export type GetTenantsForAccountOptions = BaseOptions;

/**
 * Options when requesting subscriptions for a tenant+account
 */
export type GetSubscriptionsForTenantOptions = BaseOptions & {
    /**
     * (Optional, default true) Whether to deduplicate the subscriptions returned, according to the
     * strategy in {@link dedupeSubscriptions}.
     */
    dedupe?: boolean;
};

/**
 * Options when requesting available subscriptions across all accounts and tenants.
 */
export type GetAvailableSubscriptionsOptions = GetAccountsOptions & GetTenantsForAccountOptions & GetSubscriptionsForTenantOptions & {
    /**
     * (Optional, default 10) The maximum number of tenants for which to get subscriptions. This is
     * necessary because each account+tenant requires a token request plus a subscription list request.
     * No subscription list maximum is applied; once a tenant is reached, all its subscriptions are retrieved.
     */
    maximumTenants?: number;
};

/**
 * The default options when getting availble subscriptions.
 * @note - This same value also is passed as the default to all the get* methods, since it
 * is a superset of all of the availble options.
 */
export const DefaultOptions = {
    filter: true,
    noCache: false,
    token: undefined,
    dedupe: true,
    maximumTenants: 10,
} as const satisfies GetAvailableSubscriptionsOptions;

/**
 * Gets a promise coalescence key for the given {@link GetAvailableSubscriptionsOptions}.
 * @param options The options to get the key for
 * @returns A string key for coalescing promises, or undefined if coalescing is not applicable
 * @internal This should not be used by external code. This is placed here so it can be adjacent
 * to the {@link GetAvailableSubscriptionsOptions} type, but should be used only by internal
 * implementations
 */
export function getCoalescenceKey(options: GetAvailableSubscriptionsOptions): string | undefined {
    // Never coalesce if there is a cancellation token--no way to do it safely
    if (options.token) {
        return undefined;
    }

    return Object
        .keys(options)
        .filter(k => k !== 'token') // ignore token
        .sort()
        .map((k: keyof GetAvailableSubscriptionsOptions) => `${k}:${options[k] ?? DefaultOptions[k]}`)
        .join(',');
}
