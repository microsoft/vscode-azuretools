/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { VSCodeAzureSubscriptionProvider as NextVSCodeAzureSubscriptionProvider } from '../next/VSCodeAzureSubscriptionProvider';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureAuthentication } from '../contracts/AzureAuthentication';
import type { AzureSubscription } from '../contracts/AzureSubscription';
import type { TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import { type BaseOptions, DefaultOptions, type GetAccountsOptions, type GetAvailableSubscriptionsOptions, type GetSubscriptionsForTenantOptions, type GetTenantsForAccountOptions } from '../contracts/AzureSubscriptionProviderRequestOptions'; // eslint-disable-line @typescript-eslint/no-unused-vars -- It is used in the doc comments
import type { AzureTenant } from '../contracts/AzureTenant';
import { createAzureLoggerForOutputChannel } from './azureLoggerForOutputChannel';
import { buildLegacyAuthentication, projectAccount, projectSubscription, projectTenant } from './projectToLegacy';

/**
 * Extension of {@link NextVSCodeAzureSubscriptionProvider} that adds caching of accounts, tenants, and
 * subscriptions, as well as filtering and deduplication according to configured settings. Additionally,
 * promise coalescence is added for {@link getAvailableSubscriptions}.
 *
 * @remarks This is a thin wrapper around the new (`./next`) provider, inheriting all of its caching,
 * filtering, and coalescence behavior. It only projects the new contracts back to the legacy ones,
 * re-adding the per-subscription {@link AzureAuthentication} and mapping the cloud environment to the
 * `@azure/ms-rest-azure-env`-based `ExtendedEnvironment`.
 *
 * @note See important notes about caching on {@link BaseOptions.noCache}
 */
export class VSCodeAzureSubscriptionProvider extends NextVSCodeAzureSubscriptionProvider {
    /**
     * Constructs a new {@link VSCodeAzureSubscriptionProvider}.
     * @param logger (Optional) A logger to record information to
     */
    public constructor(logger?: vscode.LogOutputChannel) {
        super({
            vscode: vscode,
            logger: logger ? createAzureLoggerForOutputChannel(logger) : undefined,
        });
    }

    /**
     * @inheritdoc
     */
    public override async getAvailableSubscriptions(options: GetAvailableSubscriptionsOptions = DefaultOptions): Promise<AzureSubscription[]> {
        // The listing methods are virtual, so the subscriptions collected by the base implementation are
        // already projected to the legacy shape (with `authentication`) by `getSubscriptionsForTenant`.
        return (await super.getAvailableSubscriptions(options)) as AzureSubscription[];
    }

    /**
     * @inheritdoc
     */
    public override async getAccounts(options: GetAccountsOptions = DefaultOptions): Promise<AzureAccount[]> {
        return (await super.getAccounts(options)).map(projectAccount);
    }

    /**
     * @inheritdoc
     */
    public override async getUnauthenticatedTenantsForAccount(account: AzureAccount, options: Omit<GetTenantsForAccountOptions, 'filter'> = DefaultOptions): Promise<AzureTenant[]> {
        return (await super.getUnauthenticatedTenantsForAccount(account, options)).map(tenant => projectTenant(tenant, account));
    }

    /**
     * @inheritdoc
     */
    public override async getTenantsForAccount(account: AzureAccount, options: GetTenantsForAccountOptions = DefaultOptions): Promise<AzureTenant[]> {
        return (await super.getTenantsForAccount(account, options)).map(tenant => projectTenant(tenant, account));
    }

    /**
     * @inheritdoc
     */
    public override async getSubscriptionsForTenant(tenant: TenantIdAndAccount, options: GetSubscriptionsForTenantOptions = DefaultOptions): Promise<AzureSubscription[]> {
        const subscriptions = await super.getSubscriptionsForTenant(tenant, options);
        const authentication = this.buildAuthentication(tenant);
        return subscriptions.map(subscription => projectSubscription(subscription, tenant, authentication));
    }

    /**
     * Builds the {@link AzureAuthentication} exposed on each {@link AzureSubscription} for the given
     * account+tenant. Subclasses may override this to supply a different means of acquiring sessions.
     *
     * @param tenant The account+tenant to build authentication for.
     * @returns An {@link AzureAuthentication} for the given account+tenant.
     */
    protected buildAuthentication(tenant: Partial<TenantIdAndAccount>): AzureAuthentication {
        return buildLegacyAuthentication(tenant, {
            getSession: (scopeOrListOrRequest, tenantId, sessionOptions) => this.getSession(scopeOrListOrRequest, tenantId, sessionOptions),
            silenceRefreshEvents: () => { this.silenceRefreshEvents(); },
            beginInteractiveRefreshSuppression: () => { this.beginInteractiveRefreshSuppression(); },
        });
    }
}
