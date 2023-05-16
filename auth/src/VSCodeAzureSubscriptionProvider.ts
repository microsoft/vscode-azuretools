/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionClient } from '@azure/arm-subscriptions'; // Keep this as `import type` to avoid actually loading the package before necessary
import type { TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package (at all, this one is dev-only)
import * as vscode from 'vscode';
import { AzureSubscription, SubscriptionId, TenantId } from './AzureSubscription';
import { NotSignedInError } from './NotSignedInError';
import { tryParseExpiresOnFromToken } from './utils/tryParseExpiresOnFromToken';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from './utils/configuredAzureEnv';

/**
 * A class for obtaining Azure subscription information using VSCode's built-in authentication
 * provider.
 */
export class VSCodeAzureSubscriptionProvider {
    /**
     * Gets a list of Azure subscriptions available to the user.
     *
     * @param filter - Whether to filter the list returned, according to the list returned
     * by `getTenantFilters()` and `getSubscriptionFilters()`.
     *
     * @returns A list of Azure subscriptions.
     * @throws {@link NotSignedInError} If the user is not signed in to Azure.
     */
    public async getSubscriptions(filter: boolean): Promise<AzureSubscription[]> {
        // If there are no items in the filter list, treat filter as if it is false, to simplify later logic
        const tenantIds = await this.getTenantFilters();
        const tenantFilterNormalized = filter && !!tenantIds.length;

        // Get subscriptions and tenant info for the default tenant
        const defaultTenantSubscriptions = await this.getSubscriptionsForTenant();
        const allSubscriptions = defaultTenantSubscriptions.subscriptions;

        // If there are none, then we need to list tenants, and get subscriptions per-tenant
        if (allSubscriptions.length === 0) {
            for await (const tenant of defaultTenantSubscriptions.client.tenants.list()) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                if (tenantFilterNormalized && !tenantIds.includes(tenant.tenantId!)) {
                    // If tenant filters are enabled, and there are items in `tenantIds`, and the current tenant is not in that list, then skip it
                    continue;
                }

                const tenantSubscriptions = await this.getSubscriptionsForTenant(tenant.tenantId);
                allSubscriptions.push(...tenantSubscriptions.subscriptions);
            }
        }

        const subscriptionIds = await this.getSubscriptionFilters();
        const subscriptionFilterNormalized = filter && !!subscriptionIds.length;

        if (subscriptionFilterNormalized) {
            return allSubscriptions.filter(subscription => !subscriptionIds.includes(subscription.subscriptionId));
        } else {
            return allSubscriptions;
        }
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
        return config.get<SubscriptionId[]>('selectedSubscriptions', []);
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
        const subscriptionIds = await this.getSubscriptionFilters();
        return subscriptionIds.map(id => id.split('/')[0]);
    }

    /**
     * Gets the subscriptions for a given tenant, or the default tenant. Also returns the client, which is reused by `getSubscriptions()`.
     *
     * @param tenantId (Optional) The tenant ID to get subscriptions for. If not specified, the default tenant will be used.
     *
     * @returns The client and list of subscriptions for the tenant.
     */
    private async getSubscriptionsForTenant(tenantId?: string): Promise<{ client: SubscriptionClient, subscriptions: AzureSubscription[] }> {
        const armSubs = await import('@azure/arm-subscriptions');

        // This will be set below, when the subscription client attempts to list the subscriptions, in the body of `getToken()`
        let session: vscode.AuthenticationSession | undefined;

        const credential: TokenCredential = {
            getToken: async (scopes) => {
                // TODO: change to `getSessions` when that API is available
                session = await vscode.authentication.getSession(getConfiguredAuthProviderId(), this.getScopes(scopes, tenantId), { createIfNone: true }); // TODO: should this create for the tenant?
                if (!session) {
                    throw new NotSignedInError();
                }

                return {
                    token: session.accessToken,
                    expiresOnTimestamp: tryParseExpiresOnFromToken(session.accessToken),
                };
            }
        }

        const client = new armSubs.SubscriptionClient(credential);

        const subscriptions: AzureSubscription[] = [];
        const environment = getConfiguredAzureEnv();

        for await (const subscription of client.subscriptions.list()) {
            subscriptions.push({
                authentication: {
                    getSession: () => session // Rewrapped to make TS not confused about the weird initialization pattern
                },
                environment: environment,
                isCustomCloud: environment.isCustomCloud,
                /* eslint-disable @typescript-eslint/no-non-null-assertion */
                name: subscription.displayName!,
                subscriptionId: subscription.subscriptionId!,
                tenantId: subscription.tenantId!,
                /* eslint-enable @typescript-eslint/no-non-null-assertion */
                credential: credential,
            });
        }

        return {
            client: client,
            subscriptions: subscriptions,
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
        return [`${getConfiguredAzureEnv().resourceManagerEndpointUrl}/.default}`]
    }
}
