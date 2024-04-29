/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TenantIdDescription } from '@azure/arm-resources-subscriptions'; // Keep this as `import type` to avoid actually loading the package before necessary
import * as vscode from 'vscode';
import { AzureSessionProvider, GetSessionBehavior } from './AzureSessionProvider';
import type { AzureSubscription, SubscriptionId, TenantId } from './AzureSubscription';
import type { AzureSubscriptionProvider } from './AzureSubscriptionProvider';
import { NotSignedInError } from './NotSignedInError';
import { VSCodeAzureSessionProvider } from './VSCodeAzureSessionProvider';
import { getConfiguredAzureEnv } from './utils/configuredAzureEnv';
import { getSubscriptionClient } from './utils/resourceManagement';

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

    private readonly sessionProvider: AzureSessionProvider;

    public constructor() {
        const sessionProvider = new VSCodeAzureSessionProvider();
        const disposable = sessionProvider.signInStatusChangeEvent((status) => {
            if (status === "SignedIn") {
                if (!this.suppressSignInEvents && Date.now() > this.lastSignInEventFired + EventDebounce) {
                    this.lastSignInEventFired = Date.now();
                    this.onDidSignInEmitter.fire();
                }
            } else if (status === "SignedOut" && Date.now() > this.lastSignOutEventFired + EventDebounce) {
                this.lastSignOutEventFired = Date.now();
                this.onDidSignOutEmitter.fire();
            }
        });

        super(() => {
            this.onDidSignInEmitter.dispose();
            this.onDidSignOutEmitter.dispose();
            disposable.dispose();
        });

        this.sessionProvider = sessionProvider;
    }

    /**
     * Gets a list of tenants available to the user.
     * Use {@link isSignedIn} to check if the user is signed in to a particular tenant.
     *
     * @returns A list of tenants.
     */
    public async getTenants(): Promise<TenantIdDescription[]> {
        return this.sessionProvider.tenants;
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
                results.push(...await this.getSubscriptionsForTenant(tenantId));
            }
        } finally {
            this.suppressSignInEvents = false;
        }

        const sortSubscriptions = (subscriptions: AzureSubscription[]): AzureSubscription[] =>
            subscriptions.sort((a, b) => a.name.localeCompare(b.name));

        const subscriptionIds = await this.getSubscriptionFilters();
        if (filter && !!subscriptionIds.length) { // If the list is empty it is treated as "no filter"
            return sortSubscriptions(
                results.filter(sub => subscriptionIds.includes(sub.subscriptionId))
            );
        }

        return sortSubscriptions(results);
    }

    /**
     * Checks to see if a user is signed in.
     *
     * @param tenantId (Optional) Provide to check if a user is signed in to a specific tenant.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    public async isSignedIn(tenantId?: string): Promise<boolean> {
        if (this.sessionProvider.signInStatus !== "SignedIn") {
            return false;
        }

        return tenantId ? this.sessionProvider.isSignedInToTenant(tenantId) : true;
    }

    /**
     * Asks the user to sign in or pick an account to use.
     *
     * @param tenantId (Optional) Provide to sign in to a specific tenant.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    public async signIn(tenantId?: string): Promise<boolean> {
        await this.sessionProvider.signIn();
        if (!tenantId) {
            return this.sessionProvider.signInStatus === "SignedIn";
        }

        await this.sessionProvider.getAuthSession(tenantId, GetSessionBehavior.PromptIfRequired);
        return this.sessionProvider.isSignedInToTenant(tenantId);
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
        const session = await this.sessionProvider.getAuthSession(tenantId, GetSessionBehavior.Silent);
        if (!session) {
            throw new NotSignedInError();
        }

        const { client, credential, authentication } = await getSubscriptionClient(session);
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
}
