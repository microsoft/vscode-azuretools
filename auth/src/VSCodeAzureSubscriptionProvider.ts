/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionClient, TenantIdDescription } from '@azure/arm-subscriptions'; // Keep this as `import type` to avoid actually loading the package before necessary
import type { TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package (at all, this one is dev-only)
import * as vscode from 'vscode';
import type { AzureAuthentication } from './AzureAuthentication';
import type { AzureSubscription, SubscriptionId, TenantId } from './AzureSubscription';
import type { AzureSubscriptionProvider } from './AzureSubscriptionProvider';
import { NotSignedInError } from './NotSignedInError';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from './utils/configuredAzureEnv';
import fetch from 'cross-fetch';

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

    public constructor() {
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
     * @returns A list of tenants.
     */
    public async getTenants(): Promise<TenantIdDescription[]> {
        const listTenantsResponse = await fetch('https://management.azure.com/tenants?api-version=2022-12-01', {
            headers: {
                Authorization: `Bearer ${await this.getToken()}`,
            }
        });
        const listTenantsResponseJson = await listTenantsResponse.json() as { value: TenantIdDescription[] };
        return listTenantsResponseJson.value.filter(tenant => tenant.displayName?.includes('Directory'));
    }

    /**
     * Gets a list of Azure subscriptions available to the user.
     *
     * @param filter - Whether to filter the list returned, according to the list returned
     * by `getTenantFilters()` and `getSubscriptionFilters()`. Optional, default true.
     *
     * @returns A list of Azure subscriptions.
     *
     * @throws A {@link NotSignedInError} If the user is not signed in to Azure.
     * Use {@link isSignedIn} and/or {@link signIn} before this method to ensure
     * the user is signed in.
     */
    public async getSubscriptions(filter: boolean = true): Promise<AzureSubscription[]> {
        const tenantIds = await this.getTenantFilters();
        const shouldFilterTenants = filter && !!tenantIds.length; // If the list is empty it is treated as "no filter"

        const subscriptionIds = await this.getSubscriptionFilters();
        const shouldFilterSubscriptions = filter && !!subscriptionIds.length; // If the list is empty it is treated as "no filter"

        const results: AzureSubscription[] = [];

        try {
            this.suppressSignInEvents = true;

            // Get the list of tenants
            for (const tenant of await this.getTenants()) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const tenantId = tenant.tenantId!;

                // If filtering is enabled, and the current tenant is not in that list, then skip it
                if (shouldFilterTenants && !tenantIds.includes(tenantId)) {
                    continue;
                }

                // If the user is not signed in to this tenant, then skip it
                if (!(await this.isSignedIn(tenantId))) {
                    continue;
                }

                // For each tenant, get the list of subscriptions
                for (const subscription of await this.getSubscriptionsForTenant(tenantId)) {
                    // If filtering is enabled, and the current subscription is not in that list, then skip it
                    if (shouldFilterSubscriptions && !subscriptionIds.includes(subscription.subscriptionId)) {
                        continue;
                    }

                    results.push(subscription);
                }
            }
        } finally {
            this.suppressSignInEvents = false;
        }

        return results.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Checks to see if a user is signed in.
     *
     * @param tenantId (Optional) Provide to check if a user is signed in to a specific tenant.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    public async isSignedIn(tenantId?: string): Promise<boolean> {
        const session = await vscode.authentication.getSession(getConfiguredAuthProviderId(), this.getScopes([], tenantId), { createIfNone: false, silent: true });
        return !!session;
    }

    /**
     * Asks the user to sign in or pick an account to use.
     *
     * @param tenantId (Optional) Provide to sign in to a specific tenant.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    public async signIn(tenantId?: string): Promise<boolean> {
        const session = await vscode.authentication.getSession(getConfiguredAuthProviderId(), this.getScopes([], tenantId), { createIfNone: true, clearSessionPreference: true });
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
     *
     * @returns The list of subscriptions for the tenant.
     */
    private async getSubscriptionsForTenant(tenantId: string): Promise<AzureSubscription[]> {
        const { client, credential, authentication } = await this.getSubscriptionClient(tenantId);
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
                /* eslint-enable @typescript-eslint/no-non-null-assertion */
                tenantId: tenantId,
            });
        }

        return subscriptions;
    }

    /**
     * Gets a fully-configured subscription client for a given tenant ID
     *
     * @param tenantId (Optional) The tenant ID to get a client for
     *
     * @returns A client, the credential used by the client, and the authentication function
     */
    private async getSubscriptionClient(tenantId?: string): Promise<{ client: SubscriptionClient, credential: TokenCredential, authentication: AzureAuthentication }> {
        const armSubs = await import('@azure/arm-subscriptions');

        // This gets filled in when the client calls `getToken`, and then it can be returned in the `authentication` property of `AzureSubscription`
        let session: vscode.AuthenticationSession | undefined;

        const credential: TokenCredential = {
            getToken: async (scopes) => {
                // TODO: if possible, change to `getSessions` when that API is available: https://github.com/microsoft/vscode/issues/152399
                session = await vscode.authentication.getSession(getConfiguredAuthProviderId(), this.getScopes(scopes, tenantId), { createIfNone: false, silent: true });
                if (!session) {
                    throw new NotSignedInError();
                }

                return {
                    token: session.accessToken,
                    expiresOnTimestamp: 0
                };
            }
        }

        return {
            client: new armSubs.SubscriptionClient(credential),
            credential: credential,
            authentication: {
                getSession: () => session // Rewrapped to make TS not confused about the weird initialization pattern
            }
        };
    }

    private async getToken(tenantId?: string): Promise<string> {
        const session = await vscode.authentication.getSession(getConfiguredAuthProviderId(), this.getScopes([], tenantId), { createIfNone: false, silent: true });

        if (!session) {
            throw new NotSignedInError();
        }

        return session.accessToken;
    }

    /**
     * Gets a normalized list of scopes
     *
     * @param scopes An input scope string, list, or undefined
     * @param tenantId (Optional) The tenant ID, will be added to the scopes
     *
     * @returns A list of scopes, with the default scope and (optionally) the tenant scope added
     */
    private getScopes(scopes: string | string[] | undefined, tenantId?: string): string[] {
        const scopeSet = new Set<string>(this.getDefaultScopes());

        // If `.default` is passed in, it will be ignored, in favor of the correct default added by `getDefaultScopes`
        if (typeof scopes === 'string' && scopes !== '.default') {
            scopeSet.add(scopes);
        } else if (Array.isArray(scopes)) {
            scopes.filter(scope => scope !== '.default').forEach(scope => scopeSet.add(scope));
        }

        if (tenantId) {
            scopeSet.add(`VSCODE_TENANT:${tenantId}`);
        }

        return Array.from(scopeSet);
    }

    /**
     * Gets the default Azure scopes required for resource management,
     * depending on the configured endpoint
     *
     * @returns The default Azure scopes required
     */
    private getDefaultScopes(): string[] {
        return [`${getConfiguredAzureEnv().resourceManagerEndpointUrl}.default`]
    }
}
