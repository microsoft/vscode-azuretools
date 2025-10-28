/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureSubscription, SubscriptionId, TenantId } from '../contracts/AzureSubscription';
import { DefaultGetOptions, DefaultGetSubscriptionsOptions, getOptionsCoalescenceKey, type GetOptions, type GetSubscriptionsOptions, type RefreshSuggestedReason, type TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';
import { dedupeSubscriptions } from '../utils/dedupeSubscriptions';
import { AzureSubscriptionProviderBase } from './AzureSubscriptionProviderBase';

const ConfigPrefix = 'azureResourceGroups';
const SelectedSubscriptionsConfigKey = 'selectedSubscriptions';

/**
 * Extension of {@link AzureSubscriptionProviderBase} that adds caching of accounts, tenants, and subscriptions,
 * as well as filtering and deduplication according to configured settings. Additionally, promise
 * coalescence is added for {@link getAvailableSubscriptions}.
 *
 * @note See important notes about caching on {@link GetOptions.noCache}
 */
export class VSCodeAzureSubscriptionProvider extends AzureSubscriptionProviderBase {
    private readonly accountCache = new Map<string, AzureAccount>(); // Key is the account ID, lowercase.
    private readonly tenantCache = new Map<string, AzureTenant[]>(); // Key is the account ID, lowercase.
    private readonly subscriptionCache = new Map<string, AzureSubscription[]>(); // Key is `${accountId}/${tenantId}`, lowercase.

    private readonly availableSubscriptionsPromises = new Map<string, Promise<AzureSubscription[]>>(); // Key is from getOptionsCoalescenceKey

    private isListeningForConfigChanges: boolean = false;

    /**
     * @inheritdoc
     */
    public override onRefreshSuggested(callback: (reason: RefreshSuggestedReason) => unknown, thisArg?: unknown, disposables?: vscode.Disposable[]): vscode.Disposable {
        if (!this.isListeningForConfigChanges) {
            this.isListeningForConfigChanges = true;
            this.disposables.push(vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration(`${ConfigPrefix}.${SelectedSubscriptionsConfigKey}`)) {
                    this.fireRefreshSuggestedIfNeeded('subscriptionFilterChange');
                }
            }));
        }

        return super.onRefreshSuggested(callback, thisArg, disposables);
    }

    /**
     * @inheritdoc
     */
    public async getAvailableSubscriptions(options: GetOptions = DefaultGetSubscriptionsOptions): Promise<AzureSubscription[]> {
        const key = getOptionsCoalescenceKey(options);
        if (key && this.availableSubscriptionsPromises.has(key)) {
            return this.availableSubscriptionsPromises.get(key)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- We just checked it has the key
        } else {
            try {
                const promise = super.getAvailableSubscriptions(options);

                if (key) {
                    this.availableSubscriptionsPromises.set(key, promise);
                }

                return await promise;
            } finally {
                if (key) {
                    this.availableSubscriptionsPromises.delete(key);
                }
            }
        }
    }

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
            accounts.forEach(account => this.accountCache.set(account.id.toLowerCase(), account));
            this.log(`Cached ${accounts.length} accounts`);
        } else {
            this.log('Using cached accounts');
        }

        let results = Array.from(this.accountCache.values());

        // If needed, filter according to configured filters
        if (!options.all) {
            const accountFilters = await this.getAccountFilters();
            if (accountFilters.length > 0) {
                this.log(`Filtering accounts to ${accountFilters.length} configured accounts`);
                results = results.filter(account => accountFilters.includes(account.id.toLowerCase()));
            }
        }

        this.log(`Returning ${results.length} accounts.`);

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
            this.logForAccount(account, `Cached ${tenants.length} tenants for account`);
        } else {
            this.logForAccount(account, 'Using cached tenants for account');
        }

        let results: AzureTenant[] = this.tenantCache.get(cacheKey)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- We just filled it

        // If needed, filter according to configured filters
        if (!options.all) {
            const tenantFilters = await this.getTenantFilters();
            if (tenantFilters.length > 0) {
                this.logForAccount(account, `Filtering tenants for account to ${tenantFilters.length} configured tenants`);
                results = results.filter(tenant => tenantFilters.includes(tenant.tenantId.toLowerCase()));
            }
        }

        this.logForAccount(account, `Returning ${results.length} tenants for account`);

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
            this.logForTenant(tenant, `Cached ${subscriptions.length} subscriptions for account+tenant`);
        } else {
            this.logForTenant(tenant, 'Using cached subscriptions for account+tenant');
        }

        let results: AzureSubscription[] = this.subscriptionCache.get(cacheKey)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- We just filled it

        // If needed, filter according to configured filters
        if (!options.all) {
            const subscriptionFilters = await this.getSubscriptionFilters();
            if (subscriptionFilters.length > 0) {
                this.logForTenant(tenant, `Filtering subscriptions for account+tenant to ${subscriptionFilters.length} configured subscriptions`);
                results = results.filter(sub => subscriptionFilters.includes(sub.subscriptionId.toLowerCase()));
            }
        }

        // If needed, dedupe according to options
        if (options.dedupe ?? true) {
            this.logForTenant(tenant, 'Deduping subscriptions for account+tenant');
            results = dedupeSubscriptions(results);
        }

        this.logForTenant(tenant, `Returning ${results.length} subscriptions for account+tenant`);

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
        const config = vscode.workspace.getConfiguration(ConfigPrefix);
        const fullSubscriptionIds = config.get<string[]>(SelectedSubscriptionsConfigKey, []);
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
        const config = vscode.workspace.getConfiguration(ConfigPrefix);
        const fullSubscriptionIds = config.get<string[]>(SelectedSubscriptionsConfigKey, []);
        return Promise.resolve(fullSubscriptionIds.map(id => id.split('/')[1].toLowerCase()));
    }
}
