/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzureSubscription } from '../contracts/AzureSubscription';

/**
 * Deduplicates (and sorts) a list of Azure subscriptions.
 * In short, the behavior is that the combination of account + tenant + subscriptionId will be unique.
 * The last appearance of any duplicates will be kept. The resulting list is sorted by subscription name.
 *
 * Please note:
 * - The same tenant may appear under different accounts.
 * - The same subscriptionId may appear under different accounts that share the same tenant.
 * - Rarely, the same subscriptionId may also appear under different accounts + different tenants.
 *
 * @param subscriptions The list of subscriptions to deduplicate
 */
export function dedupeSubscriptions(subscriptions: AzureSubscription[]): AzureSubscription[] {
    const deduped = new Map<string, AzureSubscription>();
    for (const sub of subscriptions) {
        deduped.set(
            `${sub.account.id}/${sub.tenantId}/${sub.subscriptionId}`,
            sub
        );
    }
    return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
}
