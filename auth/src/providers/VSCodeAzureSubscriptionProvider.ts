/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionClient } from '@azure/arm-resources-subscriptions'; // Keep this as `import type` to avoid actually loading the package before necessary
import type { GetTokenOptions, TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package (at all, this one is dev-only)
import * as vscode from 'vscode';
import type { AzureAuthentication } from '../contracts/AzureAuthentication';
import type { AzureSubscription, SubscriptionId, TenantId } from '../contracts/AzureSubscription';
import type { AzureSubscriptionProvider, GetOptions, GetSubscriptionsOptions, SignInOptions, TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';
import { getSessionFromVSCode } from '../utils/getSessionFromVSCode';
import { isNotSignedInError, NotSignedInError } from '../utils/NotSignedInError';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from '../utils/configuredAzureEnv';
import { isAuthenticationWwwAuthenticateRequest } from '../utils/isAuthenticationWwwAuthenticateRequest';
import { dedupeSubscriptions } from '../utils/dedupeSubscriptions';

const EventDebounce = 5 * 1000; // 5 seconds minimum between `onRefreshSuggested` events
const EventSilenceTime = 5 * 1000; // 5 seconds after sign-in to silence `onRefreshSuggested` events

let armSubs: typeof import('@azure/arm-resources-subscriptions') | undefined;

export class VSCodeAzureSubscriptionProvider implements AzureSubscriptionProvider {
    /**
     * Constructs a new {@link VSCodeAzureSubscriptionProvider}.
     * @param logger (Optional) A logger to record information to
     */
    public constructor(private readonly logger?: vscode.LogOutputChannel) { }

    private lastRefreshSuggestedTime: number = 0;
    private suppressRefreshSuggestedEvents: boolean = false;

    /**
     * @inheritdoc
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Want to match the VSCode API
    public onRefreshSuggested(callback: () => any, thisArg?: any, disposables?: vscode.Disposable[]): vscode.Disposable {
        const disposable = vscode.authentication.onDidChangeSessions((evt) => {
            if (evt.provider.id !== getConfiguredAuthProviderId()) {
                // If it's not for the configured provider, ignore it
                return;
            }

            if (this.suppressRefreshSuggestedEvents || Date.now() < this.lastRefreshSuggestedTime + EventDebounce) {
                // Suppress and/or debounce events to avoid flooding
                return;
            }

            this.logger?.debug('auth: Firing onRefreshSuggested event');

            // Call the callback asynchronously to avoid potential issues
            const timeout = setTimeout(() => {
                clearTimeout(timeout);
                this.lastRefreshSuggestedTime = Date.now();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                void callback.bind(thisArg)();
            }, 0);
        });

        disposables?.push(disposable);
        return disposable;
    }

    /**
     * @inheritdoc
     */
    public async signIn(tenant?: TenantIdAndAccount, options: SignInOptions = DefaultSignInOptions): Promise<boolean> {
        this.silenceRefreshEvents();
        const session = await getSessionFromVSCode(
            undefined,
            tenant?.tenantId,
            {
                account: tenant?.account,
                clearSessionPreference: !!options.clearSessionPreference,
                createIfNone: !options.silent,
                silent: !!options.silent,
            }
        );

        if (!options.silent) {
            // Interactive sign in can take a while, so silence events for a bit longer
            this.silenceRefreshEvents();
        }

        return !!session;
    }

    /**
     * @inheritdoc
     */
    public async getAvailableSubscriptions(options: GetOptions = DefaultGetSubscriptionsOptions): Promise<AzureSubscription[]> {
        const availableSubscriptions: AzureSubscription[] = [];

        // Intentionally not catching any errors from getAccounts(), since we want to rethrow NotSignedInError if it is thrown
        for (const account of await this.getAccounts(options)) {
            try {
                for (const tenant of await this.getTenantsForAccount(account, options)) {
                    try {
                        availableSubscriptions.push(...await this.getSubscriptionsForTenant(tenant, options));
                    } catch (err) {
                        if (isNotSignedInError(err)) {
                            this.logger?.debug(`auth: Skipping tenant '${tenant.id}' for account '${account.id}' because it is not signed in`);
                        } else {
                            this.remapAndLogError(err, options.token);
                        }
                    }
                }
            } catch (err) {
                if (isNotSignedInError(err)) {
                    this.logger?.debug(`auth: Skipping account '${account.id}' because it is not signed in`);
                    continue;
                } else {
                    this.remapAndLogError(err, options.token);
                }
            }
        }

        // Deduping and caching are handled already so nothing extra is needed here
        return availableSubscriptions.sort((a, b) => a.name.localeCompare(b.name));
    }

    private readonly accountCache: Set<vscode.AuthenticationSessionAccountInformation> = new Set();

    /**
     * @inheritdoc
     */
    public async getAccounts(options: GetOptions = DefaultGetOptions): Promise<vscode.AuthenticationSessionAccountInformation[]> {
        if (options.noCache) {
            this.accountCache.clear();
        }

        // If needed, refill the cache
        if (this.accountCache.size === 0) {
            const accounts = await this.getAllAccountsImpl(options);
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

    private async getAllAccountsImpl(options: GetOptions): Promise<vscode.AuthenticationSessionAccountInformation[]> {
        try {
            this.logger?.debug('auth: Fetching accounts');
            return Array.from(await vscode.authentication.getAccounts(getConfiguredAuthProviderId()));
        } catch (err) {
            // Cancellation is not actually supported by vscode.authentication.getAccounts, but just in case it is added in the future...
            this.remapAndLogError(err, options.token);
        }
    }

    /**
     * @inheritdoc
     */
    public async getUnauthenticatedTenants(account: vscode.AuthenticationSessionAccountInformation, options?: GetOptions): Promise<AzureTenant[]> {
        const allTenants = await this.getTenantsForAccount(account, { ...options, all: true });

        const unauthenticatedTenants: AzureTenant[] = [];
        for (const tenant of allTenants) {
            this.silenceRefreshEvents();
            const session = await getSessionFromVSCode(
                undefined,
                tenant.tenantId,
                {
                    account: account,
                    createIfNone: false,
                    silent: true,
                }
            );

            if (!session) {
                unauthenticatedTenants.push(tenant);
            }
        }

        return unauthenticatedTenants;
    }

    /**
     * Cache of tenants. The key is the account ID, lowercase.
     */
    private readonly tenantCache: Map<string, AzureTenant[]> = new Map();

    /**
     * @inheritdoc
     */
    public async getTenantsForAccount(account: vscode.AuthenticationSessionAccountInformation, options: GetOptions = DefaultGetOptions): Promise<AzureTenant[]> {
        if (options.noCache) {
            this.tenantCache.clear();
        }

        // If needed, refill the cache
        const cacheKey = account.id.toLowerCase();
        if (!this.tenantCache.has(cacheKey)) {
            const tenants = await this.getAllTenantsForAccountImpl(account, options);
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

        return results.sort((a, b) => {
            if (a.displayName && b.displayName) {
                return a.displayName.localeCompare(b.displayName);
            }

            return a.tenantId.localeCompare(b.tenantId);
        });
    }

    private async getAllTenantsForAccountImpl(account: vscode.AuthenticationSessionAccountInformation, options: GetOptions): Promise<AzureTenant[]> {
        try {
            this.logger?.debug(`auth: Fetching tenants for account '${account.id}'`);

            const { client } = await this.getSubscriptionClient({ account: account, tenantId: undefined });

            const allTenants: AzureTenant[] = [];

            for await (const tenant of client.tenants.list({ abortSignal: getSignalForToken(options.token) })) {
                allTenants.push({
                    ...tenant,
                    tenantId: tenant.tenantId!, // eslint-disable-line @typescript-eslint/no-non-null-assertion -- This is never null in practice
                    account: account,
                });
            }

            return allTenants;
        } catch (err) {
            this.remapAndLogError(err, options.token);
        }
    }

    /**
     * Cache of subscriptions. The key is `${accountId}/${tenantId}`, lowercase.
     */
    private readonly subscriptionCache: Map<string, AzureSubscription[]> = new Map();

    /**
     * @inheritdoc
     */
    public async getSubscriptionsForTenant(tenant: TenantIdAndAccount, options: GetSubscriptionsOptions = DefaultGetSubscriptionsOptions): Promise<AzureSubscription[]> {
        if (options.noCache) {
            this.subscriptionCache.clear();
        }

        // If needed, refill the cache
        const cacheKey = `${tenant.account.id.toLowerCase()}/${tenant.tenantId.toLowerCase()}`;
        if (!this.subscriptionCache.has(cacheKey)) {
            const subscriptions = await this.getAllSubscriptionsForTenantImpl(tenant, options);
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

        return results.sort((a, b) => a.name.localeCompare(b.name));
    }

    private async getAllSubscriptionsForTenantImpl(tenant: TenantIdAndAccount, options: GetSubscriptionsOptions): Promise<AzureSubscription[]> {
        try {
            this.logger?.debug(`auth: Fetching subscriptions for account '${tenant.account.id}' and tenant '${tenant.tenantId}'`);

            const { client, credential, authentication } = await this.getSubscriptionClient(tenant);
            const environment = getConfiguredAzureEnv();

            const allSubs: AzureSubscription[] = [];

            for await (const subscription of client.subscriptions.list({ abortSignal: getSignalForToken(options.token) })) {
                allSubs.push({
                    authentication: authentication,
                    environment: environment,
                    credential: credential,
                    isCustomCloud: environment.isCustomCloud,
                    /* eslint-disable @typescript-eslint/no-non-null-assertion */
                    name: subscription.displayName!,
                    subscriptionId: subscription.subscriptionId!,
                    /* eslint-enable @typescript-eslint/no-non-null-assertion */
                    tenantId: tenant.tenantId,
                    account: tenant.account,
                });
            }

            return allSubs;
        } catch (err) {
            this.remapAndLogError(err, options.token);
        }
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

    private async getSubscriptionClient(tenant: Partial<TenantIdAndAccount>): Promise<{ client: SubscriptionClient, credential: TokenCredential, authentication: AzureAuthentication }> {
        const credential: TokenCredential = {
            getToken: async (scopes: string | string[], options?: GetTokenOptions) => {
                this.silenceRefreshEvents();
                const session = await getSessionFromVSCode(scopes, options?.tenantId || tenant.tenantId, { createIfNone: false, silent: true, account: tenant.account });
                if (!session) {
                    throw new NotSignedInError();
                }
                return {
                    token: session.accessToken,
                    expiresOnTimestamp: 0, // TODO: can we get the actual expiry? Certainly not from any encrypted tokens
                };
            }
        }

        const configuredAzureEnv = getConfiguredAzureEnv();
        const endpoint = configuredAzureEnv.resourceManagerEndpointUrl;

        armSubs ??= await import('@azure/arm-resources-subscriptions');

        return {
            client: new armSubs.SubscriptionClient(credential, { endpoint }),
            credential: credential,
            authentication: {
                getSession: async () => {
                    this.silenceRefreshEvents();
                    const session = await getSessionFromVSCode(undefined, tenant.tenantId, { createIfNone: false, silent: true, account: tenant.account });
                    if (!session) {
                        throw new NotSignedInError();
                    }
                    return session;
                },
                getSessionWithScopes: async (scopeListOrRequest) => {
                    this.silenceRefreshEvents();
                    // in order to handle a challenge, we must enable createIfNone so
                    // that we can prompt the user to step-up their session with MFA
                    // otherwise, never prompt the user
                    const session = await getSessionFromVSCode(scopeListOrRequest, tenant.tenantId, { ...(isAuthenticationWwwAuthenticateRequest(scopeListOrRequest) ? { createIfNone: true } : { silent: true }), account: tenant.account });
                    if (!session) {
                        throw new NotSignedInError();
                    }
                    return session;
                },
            }
        };
    }

    private timeout: NodeJS.Timeout | undefined;
    private silenceRefreshEvents(): void {
        this.suppressRefreshSuggestedEvents = true;

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }

        this.timeout = setTimeout(() => {
            clearTimeout(this.timeout);
            this.timeout = undefined;
            this.suppressRefreshSuggestedEvents = false;
        }, EventSilenceTime);
    }

    private remapAndLogError(err: unknown, token: vscode.CancellationToken | undefined): never {
        if (token?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        this.logger?.error(`auth: Error occurred: ${err}`);
        throw err;
    }
}

const DefaultGetOptions: GetOptions = {
    all: false,
    noCache: false,
};

const DefaultGetSubscriptionsOptions: GetSubscriptionsOptions = {
    ...DefaultGetOptions,
    dedupe: true,
};

const DefaultSignInOptions: SignInOptions = {
    clearSessionPreference: false,
    silent: false,
};

function getSignalForToken(token: vscode.CancellationToken | undefined): AbortSignal | undefined {
    if (!token) {
        return undefined;
    }

    const controller = new AbortController();
    const disposable = token.onCancellationRequested(() => {
        disposable.dispose();
        controller.abort();
    });

    return controller.signal;
}
