/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionClient } from '@azure/arm-resources-subscriptions'; // Keep this as `import type` to avoid actually loading the package before necessary
import type { TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package (at all, this one is dev-only)
import * as vscode from 'vscode';
import { AzureAuthentication } from './AzureAuthentication';
import { AzureSubscription, SubscriptionId, TenantId } from './AzureSubscription';
import { AzureSubscriptionProvider, GetSubscriptionsFilter } from './AzureSubscriptionProvider';
import { AzureTenant } from './AzureTenant';
import { getSessionFromVSCode } from './getSessionFromVSCode';
import { NotSignedInError } from './NotSignedInError';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from './utils/configuredAzureEnv';
import { isAuthenticationWwwAuthenticateRequest } from './utils/isAuthenticationWwwAuthenticateRequest';

const EventDebounce = 5 * 1000; // 5 seconds

/**
 * A class for obtaining Azure subscription information using VSCode's built-in authentication
 * provider.
 */
export class VSCodeAzureSubscriptionProvider extends vscode.Disposable implements AzureSubscriptionProvider {
    private readonly onDidSignInEmitter = new vscode.EventEmitter<void>();
    private lastSignInEventFired: number = 0;
    private suppressSignInEvents: boolean = false;

    private readonly onDidSignOutEmitter = new vscode.EventEmitter<void>();
    private lastSignOutEventFired: number = 0;

    // So that customers can easily share logs, try to only log PII using trace level
    public constructor(private readonly logger?: vscode.LogOutputChannel) {
        const disposable = vscode.authentication.onDidChangeSessions(async e => {
            // Ignore any sign in that isn't for the configured auth provider
            if (e.provider.id !== getConfiguredAuthProviderId()) {
                return;
            }

            if (await this.isSignedIn()) {
                if (!this.suppressSignInEvents && Date.now() > this.lastSignInEventFired + EventDebounce) {
                    this.lastSignInEventFired = Date.now();
                    this.onDidSignInEmitter.fire();
                }
            } else if (Date.now() > this.lastSignOutEventFired + EventDebounce) {
                this.lastSignOutEventFired = Date.now();
                this.onDidSignOutEmitter.fire();
            }
        });

        super(() => {
            this.onDidSignInEmitter.dispose();
            this.onDidSignOutEmitter.dispose();
            disposable.dispose();
        });
    }

    /**
     * Gets a list of tenants available to the user.
     * Use {@link isSignedIn} to check if the user is signed in to a particular tenant.
     *
     * @param account (Optional) A specific account to get tenants for. If not provided, all accounts will be used.
     *
     * @returns A list of tenants.
     */
    public async getTenants(account?: vscode.AuthenticationSessionAccountInformation): Promise<AzureTenant[]> {
        const startTimeMs = Date.now();
        const results: AzureTenant[] = [];
        for await (account of account ? [account] : await vscode.authentication.getAccounts(getConfiguredAuthProviderId())) {
            // Added check. Without this the getSubscriptionClient function throws the NotSignedInError
            if (await this.isSignedIn(undefined, account)) {

                const { client } = await this.getSubscriptionClient(account, undefined, undefined);

                for await (const tenant of client.tenants.list()) {
                    results.push({ ...tenant, account });
                }
            }
        }
        const endTimeMs = Date.now();
        this.logger?.debug(`auth: Got ${results.length} tenants for account "${account?.label}" in ${endTimeMs - startTimeMs}ms`);
        return results;
    }

    /**
     * Gets a list of Azure subscriptions available to the user.
     *
     * @param filter - Whether to filter the list returned. When:
     * - `true`: according to the list returned by `getTenantFilters()` and `getSubscriptionFilters()`.
     * - `false`: return all subscriptions.
     * - `GetSubscriptionsFilter`: according to the values in the filter.
     *
     * Optional, default true.
     *
     * @returns A list of Azure subscriptions. The list is sorted by subscription name.
     * The list can contain duplicate subscriptions if they come from different accounts.
     *
     * @throws A {@link NotSignedInError} If the user is not signed in to Azure.
     * Use {@link isSignedIn} and/or {@link signIn} before this method to ensure
     * the user is signed in.
     */
    public async getSubscriptions(filter: boolean | GetSubscriptionsFilter = true): Promise<AzureSubscription[]> {
        this.logger?.debug('auth: Loading subscriptions...');
        const startTime = Date.now();

        const configuredTenantFilter = await this.getTenantFilters();
        const tenantIdsToFilterBy =
            // Only filter by the tenant ID option if it is provided
            (typeof filter === 'object' && filter.tenantId ? [filter.tenantId] :
                // Only filter by the configured filter if `filter` is true AND there are tenants in the configured filter
                filter === true && configuredTenantFilter.length > 0 ? configuredTenantFilter :
                    undefined);


        const allSubscriptions: AzureSubscription[] = [];
        let accountCount: number; // only used for logging
        try {
            this.suppressSignInEvents = true;
            // Get the list of tenants from each account (filtered or all)
            const accounts = typeof filter === 'object' && filter.account ? [filter.account] : await vscode.authentication.getAccounts(getConfiguredAuthProviderId());
            accountCount = accounts.length;
            for (const account of accounts) {
                for (const tenant of await this.getTenants(account)) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    const tenantId = tenant.tenantId!;

                    if (tenantIdsToFilterBy?.includes(tenantId) === false) {
                        continue;
                    }

                    // For each tenant, get the list of subscriptions
                    allSubscriptions.push(...await this.getSubscriptionsForTenant(account, tenantId));
                }

                // list subscriptions for the home tenant
                allSubscriptions.push(...await this.getSubscriptionsForTenant(account));
            }
        } finally {
            this.suppressSignInEvents = false;
        }

        // It's possible that by listing subscriptions in all tenants and the "home" tenant there could be duplicate subscriptions
        // Thus, we remove duplicate subscriptions. However, if multiple accounts have the same subscription, we keep them.
        const subscriptionMap = new Map<string, AzureSubscription>();
        allSubscriptions.forEach(sub => subscriptionMap.set(`${sub.account.id}/${sub.subscriptionId}`, sub));
        const uniqueSubscriptions = Array.from(subscriptionMap.values());

        const endTime = Date.now();
        this.logger?.debug(`auth: Got ${uniqueSubscriptions.length} subscriptions from ${accountCount} accounts in ${endTime - startTime}ms`);

        const sortSubscriptions = (subscriptions: AzureSubscription[]): AzureSubscription[] =>
            subscriptions.sort((a, b) => a.name.localeCompare(b.name));

        const subscriptionIds = await this.getSubscriptionFilters();
        if (filter === true && !!subscriptionIds.length) { // If the list is empty it is treated as "no filter"
            return sortSubscriptions(
                uniqueSubscriptions.filter(sub => subscriptionIds.includes(sub.subscriptionId))
            );
        }

        return sortSubscriptions(uniqueSubscriptions);
    }

    /**
     * Checks to see if a user is signed in.
     *
     * @param tenantId (Optional) Provide to check if a user is signed in to a specific tenant.
     * @param account (Optional) Provide to check if a user is signed in to a specific account.
     *
     * @returns True if the user is signed in, false otherwise.
     *
     * If no tenant or account is provided, then
     * checks all accounts for a session.
     */
    public async isSignedIn(tenantId?: string, account?: vscode.AuthenticationSessionAccountInformation): Promise<boolean> {
        async function silentlyCheckForSession(tenantId?: string, account?: vscode.AuthenticationSessionAccountInformation): Promise<boolean> {
            return !!await getSessionFromVSCode([], tenantId, { createIfNone: false, silent: true, account });
        }
        const innerIsSignedIn = async () => {
            // If no tenant or account is provided, then check all accounts for a session
            if (!account && !tenantId) {
                const accounts = await vscode.authentication.getAccounts(getConfiguredAuthProviderId());
                if (accounts.length === 0) {
                    return false;
                }

                for (const account of accounts) {
                    if (await silentlyCheckForSession(tenantId, account)) {
                        // If any account has a session, then return true because the user is signed in
                        return true;
                    }
                }
            }

            return silentlyCheckForSession(tenantId, account);
        }

        const result = await innerIsSignedIn();
        this.logger?.trace(`auth: isSignedIn returned ${result} (account="${account?.label ?? 'none'}") (tenantId="${tenantId ?? 'none'}")`);
        return result;
    }

    /**
     * Asks the user to sign in or pick an account to use.
     *
     * @param tenantId (Optional) Provide to sign in to a specific tenant.
     * @param account (Optional) Provide to sign in to a specific account.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    public async signIn(tenantId?: string, account?: vscode.AuthenticationSessionAccountInformation): Promise<boolean> {
        this.logger?.debug(`auth: Signing in (account="${account?.label ?? 'none'}") (tenantId="${tenantId ?? 'none'}")`);
        const session = await getSessionFromVSCode([], tenantId, {
            createIfNone: true,
            // If no account is provided, then clear the session preference which tells VS Code to show the account picker
            clearSessionPreference: !account,
            account,
        });
        return !!session;
    }

    /**
     * An event that is fired when the user signs in. Debounced to fire at most once every 5 seconds.
     */
    public readonly onDidSignIn = this.onDidSignInEmitter.event;

    /**
     * Signs the user out
     *
     * @deprecated Not currently supported by VS Code auth providers
     */
    public signOut(): Promise<void> {
        throw new Error(vscode.l10n.t('Signing out programmatically is not supported. You must sign out by selecting the account in the Accounts menu and choosing Sign Out.'));
    }

    /**
     * An event that is fired when the user signs out. Debounced to fire at most once every 5 seconds.
     */
    public readonly onDidSignOut = this.onDidSignOutEmitter.event;

    /**
     * Gets the tenant filters that are configured in `azureResourceGroups.selectedSubscriptions`. To
     * override the settings with a custom filter, implement a child class with `getSubscriptionFilters()`
     * and/or `getTenantFilters()` overridden.
     *
     * If no values are returned by `getTenantFilters()`, then all tenants will be scanned for subscriptions.
     *
     * @returns A list of tenant IDs that are configured in `azureResourceGroups.selectedSubscriptions`.
     */
    protected async getTenantFilters(): Promise<TenantId[]> {
        const config = vscode.workspace.getConfiguration('azureResourceGroups');
        const fullSubscriptionIds = config.get<string[]>('selectedSubscriptions', []);

        return fullSubscriptionIds.map(id => id.split('/')[0]);
    }

    /**
     * Gets the subscription filters that are configured in `azureResourceGroups.selectedSubscriptions`. To
     * override the settings with a custom filter, implement a child class with `getSubscriptionFilters()`
     * and/or `getTenantFilters()` overridden.
     *
     * If no values are returned by `getSubscriptionFilters()`, then all subscriptions will be returned.
     *
     * @returns A list of subscription IDs that are configured in `azureResourceGroups.selectedSubscriptions`.
     */
    protected async getSubscriptionFilters(): Promise<SubscriptionId[]> {
        const config = vscode.workspace.getConfiguration('azureResourceGroups');
        const fullSubscriptionIds = config.get<string[]>('selectedSubscriptions', []);
        return fullSubscriptionIds.map(id => id.split('/')[1]);
    }

    /**
     * Gets the subscriptions for a given tenant.
     *
     * @param tenantId The tenant ID to get subscriptions for.
     * @param account The account to get the subscriptions for.
     *
     * @returns The list of subscriptions for the tenant.
     */
    private async getSubscriptionsForTenant(account: vscode.AuthenticationSessionAccountInformation, tenantId?: string): Promise<AzureSubscription[]> {
        // If the user is not signed in to this tenant or account, then return an empty list
        // This is to prevent the NotSignedInError from being thrown in getSubscriptionClient
        if (!await this.isSignedIn(tenantId, account)) {
            return [];
        }

        const { client, credential, authentication } = await this.getSubscriptionClient(account, tenantId, undefined);
        const environment = getConfiguredAzureEnv();

        const subscriptions: AzureSubscription[] = [];

        for await (const subscription of client.subscriptions.list()) {
            subscriptions.push({
                authentication: authentication,
                environment: environment,
                credential: credential,
                isCustomCloud: environment.isCustomCloud,
                /* eslint-disable @typescript-eslint/no-non-null-assertion */
                name: subscription.displayName!,
                subscriptionId: subscription.subscriptionId!,
                tenantId: tenantId ?? subscription.tenantId!,
                /* eslint-enable @typescript-eslint/no-non-null-assertion */
                account: account
            });
        }

        return subscriptions;
    }

    /**
     * Gets a fully-configured subscription client for a given tenant ID
     *
     * @param tenantId (Optional) The tenant ID to get a client for
     * @param account The account that you would like to get the session for
     *
     * @returns A client, the credential used by the client, and the authentication function
     */
    private async getSubscriptionClient(account: vscode.AuthenticationSessionAccountInformation, tenantId?: string, scopes?: string[]): Promise<{ client: SubscriptionClient, credential: TokenCredential, authentication: AzureAuthentication }> {
        const armSubs = await import('@azure/arm-resources-subscriptions');

        const session = await getSessionFromVSCode(scopes, tenantId, { createIfNone: false, silent: true, account });

        if (!session) {
            throw new NotSignedInError();
        }

        const credential: TokenCredential = {
            getToken: async () => {
                return {
                    token: session.accessToken,
                    expiresOnTimestamp: 0
                };
            }
        }

        const configuredAzureEnv = getConfiguredAzureEnv();
        const endpoint = configuredAzureEnv.resourceManagerEndpointUrl;

        return {
            client: new armSubs.SubscriptionClient(credential, { endpoint }),
            credential: credential,
            authentication: {
                getSession: () => session,
                getSessionWithScopes: (scopeListOrRequest) => {

                    // in order to handle a challenge, we must enable createIfNone so
                    // that we can prompt the user to step-up their session with MFA
                    // otherwise, never prompt the user
                    return getSessionFromVSCode(scopeListOrRequest, tenantId, { ...(isAuthenticationWwwAuthenticateRequest(scopeListOrRequest) ? { createIfNone: true } : { silent: true }), account });
                },
            }
        };
    }
}
