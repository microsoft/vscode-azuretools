/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureSubscriptionProviderBase as NextAzureSubscriptionProviderBase, type CredentialFactory } from '../next/AzureSubscriptionProviderBase';
import { createVsCodeCredentialFactory } from '../next/vscodeCredentialFactory';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureAuthentication } from '../contracts/AzureAuthentication';
import type { AzureSubscription } from '../contracts/AzureSubscription';
import type { AzureSubscriptionProvider, TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import { DefaultOptions, type GetAccountsOptions, type GetAvailableSubscriptionsOptions, type GetSubscriptionsForTenantOptions, type GetTenantsForAccountOptions } from '../next/contracts/AzureSubscriptionProviderRequestOptions';
import type { AzureTenant } from '../contracts/AzureTenant';
import { createAzureLoggerForOutputChannel } from './azureLoggerForOutputChannel';
import { buildLegacyAuthentication, projectAccount, projectSubscription, projectTenant } from './projectToLegacy';

/**
 * Base class for Azure subscription providers that use VS Code authentication.
 * Handles actual communication with Azure via the Azure SDK, as well as
 * controlling the firing of `onRefreshSuggested` events.
 *
 * @remarks This is a thin wrapper around the new (`./next`) {@link NextAzureSubscriptionProviderBase}.
 * It injects the real `vscode` namespace and projects the new contracts back to the legacy ones, re-adding
 * the per-subscription {@link AzureAuthentication} and mapping the cloud environment to the
 * `@azure/ms-rest-azure-env`-based `ExtendedEnvironment`.
 */
export abstract class AzureSubscriptionProviderBase extends NextAzureSubscriptionProviderBase implements AzureSubscriptionProvider {
    /**
     * Constructs a new {@link AzureSubscriptionProviderBase}.
     * @param logger (Optional) A logger to record information to
     * @param credentialFactory (Optional) A factory that creates the token credential for a given
     * account+tenant. Subclasses (e.g. the Azure DevOps provider) supply this to control how tokens are
     * acquired. If omitted, the default VS Code credential factory is used.
     */
    public constructor(logger?: vscode.LogOutputChannel, credentialFactory?: CredentialFactory) {
        const azureLogger = logger ? createAzureLoggerForOutputChannel(logger) : undefined;
        super({
            vscode: vscode,
            logger: azureLogger,
            credentialFactory: credentialFactory ?? createVsCodeCredentialFactory(vscode, azureLogger),
        });
    }

    /**
     * @inheritdoc
     */
    public override async getAvailableSubscriptions(options: GetAvailableSubscriptionsOptions = DefaultOptions): Promise<AzureSubscription[]> {
        // The listing methods are virtual, so the subscriptions produced by the base implementation are
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
     * account+tenant. Subclasses (e.g. the Azure DevOps provider) may override this to supply a different
     * means of acquiring sessions.
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
