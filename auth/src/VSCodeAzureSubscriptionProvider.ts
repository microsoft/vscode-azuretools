/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionClient, TenantIdDescription } from '@azure/arm-subscriptions'; // Keep this as `import type` to avoid actually loading the package before necessary
import type { TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package (at all, this one is dev-only)
import * as vscode from 'vscode';
import type { AzureSubscription, SubscriptionId, TenantId } from './AzureSubscription';
import { NotSignedInError } from './NotSignedInError';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from './utils/configuredAzureEnv';
import type { AzureAuthentication } from './AzureAuthentication';
import type { AzureSubscriptionProvider } from './AzureSubscriptionProvider';

/**
 * A class for obtaining Azure subscription information using VSCode's built-in authentication
 * provider.
 */
export class VSCodeAzureSubscriptionProvider implements AzureSubscriptionProvider {
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
        const tenantFilterNormalized = filter && !!tenantIds.length; // If the list is empty it is treated as "no filter"

        const subscriptionIds = await this.getSubscriptionFilters();
        const subscriptionFilterNormalized = filter && !!subscriptionIds.length; // If the list is empty it is treated as "no filter"

        const results: AzureSubscription[] = [];

        // Get the list of tenants
        for (const tenant of await this.getTenants()) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const tenantId = tenant.tenantId!;

            // If filtering is enabled, and the current tenant is not in that list, then skip it
            if (tenantFilterNormalized && !tenantIds.includes(tenantId)) {
                continue;
            }

            // For each tenant, get the list of subscriptions
            for (const subscription of await this.getSubscriptionsForTenant(tenantId)) {
                // If filtering is enabled, and the current subscription is not in that list, then skip it
                if (subscriptionFilterNormalized && !subscriptionIds.includes(subscription.subscriptionId)) {
                    continue;
                }

                results.push(subscription);
            }
        }

        return results;
    }

    /**
     * Checks to see if a user is signed in.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    public async isSignedIn(): Promise<boolean> {
        const session = await vscode.authentication.getSession(getConfiguredAuthProviderId(), this.getDefaultScopes(), { createIfNone: false, silent: true });
        return !!session;
    }

    /**
     * Asks the user to sign in or pick an account to use.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    public async signIn(): Promise<boolean> {
        const session = await vscode.authentication.getSession(getConfiguredAuthProviderId(), this.getDefaultScopes(), { createIfNone: true, clearSessionPreference: true });
        return !!session;
    }

    /**
     * Signs the user out
     *
     * @deprecated Not currently supported by VS Code auth providers
     */
    public signOut(): Promise<void> {
        throw new Error(vscode.l10n.t('Not implemented'));
    }

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
     * Gets the tenants available to a user.
     *
     * @returns The list of tenants visible to the user.
     */
    private async getTenants(): Promise<TenantIdDescription[]> {
        const { client } = await this.getSubscriptionClient();
        const tenants: TenantIdDescription[] = [];

        for await (const tenant of client.tenants.list()) {
            tenants.push(tenant);
        }

        return tenants;
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
                // TODO: change to `getSessions` when that API is available
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

        if (typeof scopes === 'string') {
            scopeSet.add(scopes);
        } else if (Array.isArray(scopes)) {
            scopes.forEach(scope => scopeSet.add(scope));
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
