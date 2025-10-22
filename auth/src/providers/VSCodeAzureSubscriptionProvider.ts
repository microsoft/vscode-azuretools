/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureSubscription, SubscriptionId, TenantId } from '../contracts/AzureSubscription';
import type { GetOptions, GetSubscriptionsOptions, TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';
import { dedupeSubscriptions } from '../utils/dedupeSubscriptions';
import { NotSignedInError } from '../utils/NotSignedInError';
import { AzureSubscriptionProviderBase, DefaultGetOptions, DefaultGetSubscriptionsOptions } from './AzureSubscriptionProviderBase';

/**
 * Extension of {@link AzureSubscriptionProviderBase} that adds caching of accounts, tenants, and subscriptions,
 * as well as filtering and deduplication according to configured settings.
 */
export class VSCodeAzureSubscriptionProvider extends AzureSubscriptionProviderBase {
    /**
     * Cache of accounts.
     */
    private readonly accountCache: Set<AzureAccount> = new Set();

    /**
     * Cache of tenants. The key is the account ID, lowercase.
     */
    private readonly tenantCache: Map<string, AzureTenant[]> = new Map();

    /**
     * Cache of subscriptions. The key is `${accountId}/${tenantId}`, lowercase.
     */
    private readonly subscriptionCache: Map<string, AzureSubscription[]> = new Map();

    /**
     * @inheritdoc
     */
    public override async getAccounts(options: GetOptions = DefaultGetOptions): Promise<AzureAccount[]> {
        if (options.noCache) {
            this.accountCache.clear();
        }

        // If needed, refill the cache
        if (this.accountCache.size === 0) {
            const accounts = await super.getAccounts(options);
            if (accounts.length === 0) {
                this.logger?.debug('auth: No accounts found');
                throw new NotSignedInError();
            } else {
                accounts.forEach(account => this.accountCache.add(account));
                this.logger?.debug(`auth: Cached ${accounts.length} accounts`);
            }
        } else {
            this.logger?.debug('auth: Using cached accounts');
        }

        let results = Array.from(this.accountCache);

        // If needed, filter according to configured filters
        if (!options.all) {
            const accountFilters = await this.getAccountFilters();
            if (accountFilters.length > 0) {
                this.logger?.debug(`auth: Filtering accounts to ${accountFilters.length} configured accounts`);
                results = results.filter(account => accountFilters.includes(account.id.toLowerCase()));
            }
        }

        return results.sort((a, b) => a.label.localeCompare(b.label));
    }

    /**
     * @inheritdoc
     */
    public override async getTenantsForAccount(account: AzureAccount, options: GetOptions = DefaultGetOptions): Promise<AzureTenant[]> {
        const cacheKey = account.id.toLowerCase();

        // If needed, delete the cache for this account
        if (options.noCache) {
            this.tenantCache.delete(cacheKey);
        }

        // If needed, refill the cache
        if (!this.tenantCache.has(cacheKey)) {
            const tenants = await super.getTenantsForAccount(account, options);
            this.tenantCache.set(cacheKey, tenants);
            this.logger?.debug(`auth: Cached ${tenants.length} tenants for account '${account.id}'`);
        } else {
            this.logger?.debug(`auth: Using cached tenants for account '${account.id}'`);
        }

        let results: AzureTenant[] = this.tenantCache.get(cacheKey)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- We just filled it

        // If needed, filter according to configured filters
        if (!options.all) {
            const tenantFilters = await this.getTenantFilters();
            if (tenantFilters.length > 0) {
                this.logger?.debug(`auth: Filtering tenants for account '${account.id}' to ${tenantFilters.length} configured tenants`);
                results = results.filter(tenant => tenantFilters.includes(tenant.tenantId.toLowerCase()));
            }
        }

        // Finally, sort
        return results.sort((a, b) => {
            if (a.displayName && b.displayName) {
                return a.displayName.localeCompare(b.displayName);
            }

            return a.tenantId.localeCompare(b.tenantId);
        });
    }

    /**
     * @inheritdoc
     */
    public override async getSubscriptionsForTenant(tenant: TenantIdAndAccount, options: GetSubscriptionsOptions = DefaultGetSubscriptionsOptions): Promise<AzureSubscription[]> {
        const cacheKey = `${tenant.account.id.toLowerCase()}/${tenant.tenantId.toLowerCase()}`;

        // If needed, delete the cache for this tenant
        if (options.noCache) {
            this.subscriptionCache.delete(cacheKey);
        }

        // If needed, refill the cache
        if (!this.subscriptionCache.has(cacheKey)) {
            const subscriptions = await super.getSubscriptionsForTenant(tenant, options);
            this.subscriptionCache.set(cacheKey, subscriptions);
            this.logger?.debug(`auth: Cached ${subscriptions.length} subscriptions for account '${tenant.account.id}' and tenant '${tenant.tenantId}'`);
        }

        let results: AzureSubscription[] = this.subscriptionCache.get(cacheKey)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- We just filled it

        // If needed, filter according to configured filters
        if (!options.all) {
            const subscriptionFilters = await this.getSubscriptionFilters();
            if (subscriptionFilters.length > 0) {
                this.logger?.debug(`auth: Filtering subscriptions for account '${tenant.account.id}' and tenant '${tenant.tenantId}' to ${subscriptionFilters.length} configured subscriptions`);
                results = results.filter(sub => subscriptionFilters.includes(sub.subscriptionId.toLowerCase()));
            }
        }

        // If needed, dedupe according to options
        if (options.dedupe ?? true) {
            this.logger?.debug(`auth: Deduping subscriptions for account '${tenant.account.id}' and tenant '${tenant.tenantId}'`);
            results = dedupeSubscriptions(results);
        }

        // Finally, sort
        return results.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Gets the account filters that are configured in `azureResourceGroups.selectedSubscriptions`. To
     * override the settings with a custom filter, implement a child class with filter methods overridden.
     *
     * If no values are returned by `getAccountFilters()`, then all accounts will be scanned for subscriptions.
     *
     * @returns A list of account IDs that are configured in `azureResourceGroups.selectedSubscriptions`.
     */
    protected getAccountFilters(): Promise<string[]> {
        // TODO: implement account filtering based on configuration if needed
        // TODO: cannot have PII in the settings so it has to be an ID--test that
        return Promise.resolve([]);
    }

    /**
     * Gets the tenant filters that are configured in `azureResourceGroups.selectedSubscriptions`. To
     * override the settings with a custom filter, implement a child class with filter methods overridden.
     *
     * If no values are returned by `getTenantFilters()`, then all tenants will be scanned for subscriptions.
     *
     * @returns A list of tenant IDs that are configured in `azureResourceGroups.selectedSubscriptions`.
     */
    protected getTenantFilters(): Promise<TenantId[]> {
        const config = vscode.workspace.getConfiguration('azureResourceGroups');
        const fullSubscriptionIds = config.get<string[]>('selectedSubscriptions', []);
        return Promise.resolve(fullSubscriptionIds.map(id => id.split('/')[0].toLowerCase()));
    }

    /**
     * Gets the subscription filters that are configured in `azureResourceGroups.selectedSubscriptions`. To
     * override the settings with a custom filter, implement a child class with filter methods overridden.
     *
     * If no values are returned by `getSubscriptionFilters()`, then all subscriptions will be scanned.
     *
     * @returns A list of subscription IDs that are configured in `azureResourceGroups.selectedSubscriptions`.
     */
    protected getSubscriptionFilters(): Promise<SubscriptionId[]> {
        const config = vscode.workspace.getConfiguration('azureResourceGroups');
        const fullSubscriptionIds = config.get<string[]>('selectedSubscriptions', []);
        return Promise.resolve(fullSubscriptionIds.map(id => id.split('/')[1].toLowerCase()));
    }
}
