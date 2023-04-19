/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionClient } from '@azure/arm-subscriptions'; // Keep this as `import type` to avoid actually loading the package before necessary
import type { TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package (at all, this one is dev-only)
import * as azureEnv from '@azure/ms-rest-azure-env'; // This package is so small that it's not worth lazy loading
import * as vscode from 'vscode';
import { AzureSubscription, SubscriptionId } from './AzureSubscription';
import { NotSignedInError } from './NotSignedInError';
import { caselessIncludes } from './utils/caselessIncludes';

/**
 * A class for obtaining Azure subscription information using VSCode's built-in authentication
 * provider.
 */
export class VSCodeAzureSubscriptionProvider {
    /**
     * Gets a list of Azure subscriptions available to the user.
     *
     * @param filter - Whether to filter the list returned, according to the list returned
     * by `getFilters()`.
     *
     * @returns A list of Azure subscriptions.
     * @throws {@link NotSignedInError} If the user is not signed in to Azure.
     */
    public async getSubscriptions(filter: boolean): Promise<AzureSubscription[]> {
        // If there are no items in the filter list, treat filter as if it is false, to simplify later logic
        const subscriptionIds = await this.getFilters();
        const filterNormalized = filter && !!subscriptionIds.length;
        const tenantIds = subscriptionIds.map(id => id.split('/')[0]);

        // Get subscriptions and tenant info for the default tenant
        const defaultTenantSubscriptions = await this.getSubscriptionsForTenant();
        const allSubscriptions = defaultTenantSubscriptions.subscriptions;

        // If there are none, then we need to list tenants, and get subscriptions per-tenant
        if (allSubscriptions.length === 0) {
            for await (const tenant of defaultTenantSubscriptions.client.tenants.list()) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                if (filterNormalized && !caselessIncludes(tenantIds, tenant.tenantId!)) {
                    // If filters are enabled, and there are items in `tenantIds`, and the current tenant is not in that list, then skip it
                    continue;
                }

                const tenantSubscriptions = await this.getSubscriptionsForTenant(tenant.tenantId);
                allSubscriptions.push(...tenantSubscriptions.subscriptions);
            }
        }

        if (filterNormalized) {
            return allSubscriptions.filter(subscription => caselessIncludes(subscriptionIds, subscription.subscriptionId));
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
        const session = await vscode.authentication.getSession(this.authProviderId, this.getDefaultScopes(), { createIfNone: false, silent: true });
        return !!session;
    }

    /**
     * Asks the user to sign in or pick an account to use.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    public async signIn(): Promise<boolean> {
        const session = await vscode.authentication.getSession(this.authProviderId, this.getDefaultScopes(), { createIfNone: true, clearSessionPreference: true });
        return !!session;
    }

    /**
     * Gets the filters that are configured in `azureResourceGroups.selectedSubscriptions`. To
     * override the settings with a custom filter, implement a child class with `getFilters()`
     * overridden.
     *
     * If a tenant to which the user has access does not appear in the list, that tenant will be
     * ignored.
     *
     * If no values are returned by `getFilters()`, then all subscriptions will be returned.
     *
     * @returns A list of subscription IDs that are configured in `azureResourceGroups.selectedSubscriptions`.
     */
    protected async getFilters(): Promise<SubscriptionId[]> {
        const config = vscode.workspace.getConfiguration('azureResourceGroups');
        return config.get<SubscriptionId[]>('selectedSubscriptions', []);
    }

    /**
     * Gets the configured Azure environment
     *
     * @returns The Azure environment configured to use by the `microsoft-sovereign-cloud.endpoint` setting
     */
    private getConfiguredAzureEnv(): azureEnv.Environment {
        const authProviderConfig = vscode.workspace.getConfiguration('microsoft-sovereign-cloud');
        const endpoint = authProviderConfig.get<string | undefined>('endpoint')?.toLowerCase();

        // The endpoint setting will accept either the environment name (either 'Azure China' or 'Azure US Government'),
        // or an endpoint URL. Since the user could configure the same environment either way, we need to check both.
        // We'll also throw to lowercase just to maximize the chance of success.

        if (endpoint === 'azure china' || endpoint === 'https://login.chinacloudapi.cn/') {
            return azureEnv.Environment.ChinaCloud;
        } else if (endpoint === 'azure us government' || endpoint === 'https://login.microsoftonline.us/') {
            return azureEnv.Environment.USGovernment;
        } else if (endpoint) {
            // TODO: support custom clouds
            throw new Error('Custom clouds are not supported yet');
        }

        return azureEnv.Environment.AzureCloud;
    }

    /**
     * Which authentication provider to use. By default it will be 'microsoft', but if there is a value
     * for the setting `microsoft-sovereign-cloud.endpoint` then it will be 'microsoft-sovereign-cloud'.
     */
    private get authProviderId(): string {
        const configuredEnv = this.getConfiguredAzureEnv();
        return configuredEnv.name === azureEnv.Environment.AzureCloud.name ? 'microsoft' : 'microsoft-sovereign-cloud';
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
                session = await vscode.authentication.getSession(this.authProviderId, this.getScopes(scopes, tenantId), { createIfNone: true }); // TODO: should this create for the tenant?
                if (!session) {
                    throw new NotSignedInError();
                }

                return {
                    token: session.accessToken,
                    expiresOnTimestamp: 0, // TODO: How to get this?
                };
            }
        }

        const client = new armSubs.SubscriptionClient(credential);

        const subscriptions: AzureSubscription[] = [];

        for await (const subscription of client.subscriptions.list()) {
            subscriptions.push({
                authentication: {
                    getSession: () => session // Rewrapped to make TS not confused about the weird initialization pattern
                },
                environment: this.getConfiguredAzureEnv(),
                isCustomCloud: false, // TODO: support custom clouds
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                name: subscription.displayName!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                subscriptionId: subscription.subscriptionId!,
                tenantId: subscription.tenantId,
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
     * Gets the default Azure scopes depending on the configured endpoint
     *
     * @returns The default Azure scopes depending on the configured endpoint
     */
    private getDefaultScopes(): string[] {
        return [`${this.getConfiguredAzureEnv().resourceManagerEndpointUrl}/.default}`]
    }
}
