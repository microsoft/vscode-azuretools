/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { SubscriptionClient } from '@azure/arm-subscriptions';
import type { TokenCredential } from '@azure/core-auth';
import { AzureSubscription, SubscriptionId } from './AzureSubscription';
import { NotSignedInError } from './NotSignedInError';
import { caselessIncludes } from './utils/caselessIncludes';

const DefaultAzureScope = 'https://management.azure.com/.default';

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

        let allSubscriptions: AzureSubscription[];

        // Get subscriptions and tenant info for the default tenant
        const defaultTenantSubscriptions = await this.getSubscriptionsForTenant();
        allSubscriptions = defaultTenantSubscriptions.subscriptions;

        // If there are none, then we need to list tenants, and get subscriptions per-tenant
        if (allSubscriptions.length === 0) {
            for await (const tenant of defaultTenantSubscriptions.client.tenants.list()) {
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
    public async getFilters(): Promise<SubscriptionId[]> {
        return [];
    }

    /**
     * Checks to see if a user is signed in.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    public async isSignedIn(): Promise<boolean> {
        const session = await vscode.authentication.getSession(this.authProviderId, [DefaultAzureScope], { createIfNone: false, silent: true });
        return !!session;
    }

    /**
     * Asks the user to sign in or pick an account to use.
     *
     * @returns True if the user is signed in, false otherwise.
     */
    public async signIn(): Promise<boolean> {
        const session = await vscode.authentication.getSession(this.authProviderId, [DefaultAzureScope], { createIfNone: true, clearSessionPreference: true });
        return !!session;
    }

    /**
     * Which authentication provider to use. By default it will be 'microsoft', but if there is a value
     * for the setting `azure-cloud.endpoint` then it will be 'azure-cloud'.
     */
    private get authProviderId(): string {
        const authProviderConfig = vscode.workspace.getConfiguration('azure-cloud');
        return !!authProviderConfig.get<string | undefined>('endpoint') ? 'microsoft' : 'azure-cloud';
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
        const azureEnv = await import('@azure/ms-rest-azure-env');

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
                environment: azureEnv.Environment.AzureCloud, // TODO: support sovereign clouds
                isCustomCloud: false, // TODO: support sovereign / custom clouds
                name: subscription.displayName!, // Won't be undefined
                subscriptionId: subscription.subscriptionId!, // Won't be undefined
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
        const scopeSet = new Set<string>([DefaultAzureScope]);

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
}
