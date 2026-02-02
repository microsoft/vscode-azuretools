/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzureSubscriptionProvider } from '../contracts/AzureSubscriptionProvider';

/**
 * Telemetry metrics about Azure authentication.
 */
export interface AzureAuthTelemetryMetrics {
    /**
     * The total number of accounts. This number is always accurate.
     */
    totalAccounts: number;

    /**
     * The total number of tenants. This number only includes tenants for signed-in accounts.
     */
    visibleTenants: number;

    /**
     * The total number of subscriptions, but limited to querying the first 10 account+tenants.
     */
    visibleSubscriptions: number;

    /**
     * A JSON-stringified list of subscription IDs (up to 25).
     */
    subscriptionIdList: string;

    /**
     * Whether the subscription ID list is incomplete (i.e. there were more than 25 subscriptions).
     */
    subscriptionIdListIsIncomplete: boolean;
}

/**
 * Gets telemetry metrics about accounts, tenants, and subscriptions.
 * @param subscriptionProvider The subscription provider to use to get the metrics.
 * @throws A NotSignedInError if no accounts are signed in.
 */
export async function getMetricsForTelemetry(subscriptionProvider: AzureSubscriptionProvider): Promise<AzureAuthTelemetryMetrics> {
    // Get the total number of accounts (requires no web requests)
    // Errors are deliberately not caught here, so if no accounts are signed in, this will throw
    const accounts = await subscriptionProvider.getAccounts();
    const numAccounts = accounts.length;

    // Get the total number of tenants across all accounts (requires one web request per account, which is reasonable)
    let numTenants = 0;
    for (const account of accounts) {
        try {
            const tenants = await subscriptionProvider.getTenantsForAccount(account);
            numTenants += tenants.length;
        } catch {
            continue; // If we can't get tenants for an account, skip it instead of throwing
        }
    }

    // Get as many subscriptions as we can (requires one web request per account+tenant)
    // This is limited to the first 10 account+tenants, thus a max of 10 web requests
    // Errors are deliberately not caught here; none are expected since at least one account is signed in
    const subscriptions = await subscriptionProvider.getAvailableSubscriptions();
    const numSubscriptions = subscriptions.length;

    // Get subscription IDs (up to 25)
    const subscriptionSet = new Set<string>();
    subscriptions.slice(0, 25).forEach(sub => {
        subscriptionSet.add(sub.subscriptionId);
    });

    return {
        totalAccounts: numAccounts,
        visibleTenants: numTenants,
        visibleSubscriptions: numSubscriptions,
        subscriptionIdList: JSON.stringify(Array.from(subscriptionSet)),
        subscriptionIdListIsIncomplete: subscriptions.length > 25,
    };
}
