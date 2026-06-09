/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureSubscriptionProviderBase as NextAzureSubscriptionProviderBase } from '../next/AzureSubscriptionProviderBase';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureAuthentication } from '../contracts/AzureAuthentication';
import type { AzureSubscription } from '../contracts/AzureSubscription';
import type { AzureSubscriptionProvider, TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import { DefaultOptions, type GetAccountsOptions, type GetAvailableSubscriptionsOptions, type GetSubscriptionsForTenantOptions, type GetTenantsForAccountOptions } from '../contracts/AzureSubscriptionProviderRequestOptions';
import type { AzureTenant } from '../contracts/AzureTenant';
import { getConfiguredAzureEnv } from '../utils/configuredAzureEnv';
import { isAuthenticationWwwAuthenticateRequest } from '../utils/isAuthenticationWwwAuthenticateRequest';
import { NotSignedInError } from '../utils/NotSignedInError';
import { createAzureLoggerForOutputChannel } from './azureLoggerForOutputChannel';

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
        // The listing methods are virtual, so the subscriptions produced by the base implementation are
        // already projected to the legacy shape (with `authentication`) by `getSubscriptionsForTenant`.
        return (await super.getAvailableSubscriptions(options)) as AzureSubscription[];
    }

    /**
     * @inheritdoc
     */
    public override async getAccounts(options: GetAccountsOptions = DefaultOptions): Promise<AzureAccount[]> {
        const accounts = await super.getAccounts(options);
        const environment = getConfiguredAzureEnv();
        return accounts.map(account => ({ ...account, environment }));
    }

    /**
     * @inheritdoc
     */
    public override async getUnauthenticatedTenantsForAccount(account: AzureAccount, options: Omit<GetTenantsForAccountOptions, 'filter'> = DefaultOptions): Promise<AzureTenant[]> {
        const tenants = await super.getUnauthenticatedTenantsForAccount(account, options);
        return tenants.map(tenant => ({ ...tenant, account }));
    }

    /**
     * @inheritdoc
     */
    public override async getTenantsForAccount(account: AzureAccount, options: GetTenantsForAccountOptions = DefaultOptions): Promise<AzureTenant[]> {
        const tenants = await super.getTenantsForAccount(account, options);
        return tenants.map(tenant => ({ ...tenant, account }));
    }

    /**
     * @inheritdoc
     */
    public override async getSubscriptionsForTenant(tenant: TenantIdAndAccount, options: GetSubscriptionsForTenantOptions = DefaultOptions): Promise<AzureSubscription[]> {
        const subscriptions = await super.getSubscriptionsForTenant(tenant, options);
        const environment = getConfiguredAzureEnv();
        const authentication = this.buildAuthentication(tenant);

        return subscriptions.map(subscription => ({
            authentication: authentication,
            environment: environment,
            isCustomCloud: environment.isCustomCloud,
            name: subscription.name,
            subscriptionId: subscription.subscriptionId,
            tenantId: subscription.tenantId,
            credential: subscription.credential,
            account: tenant.account,
        }));
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
        return {
            getSession: async () => {
                this.silenceRefreshEvents();
                const session = await this.getSession(undefined, tenant.tenantId, { createIfNone: false, silent: true, account: tenant.account });
                if (!session) {
                    throw new NotSignedInError();
                }
                return session;
            },
            getSessionWithScopes: async (scopeListOrRequest, options) => {
                // A challenge (e.g. an MFA step-up) must always be able to prompt so the user can satisfy
                // it. For a plain scope list we stay silent by default, but allow callers to opt in to an
                // interactive consent prompt via `options.createIfNone` (used, for example, to consent to
                // the App Service audience before a deployment).
                // See https://github.com/microsoft/vscode-azurefunctions/issues/5073
                const createIfNone = isAuthenticationWwwAuthenticateRequest(scopeListOrRequest) || !!options?.createIfNone;
                if (createIfNone) {
                    // Interactive consent can take a while, so suppress without timeout until it is done,
                    // then silence for a bit longer afterwards (same pattern as `signIn`).
                    this.beginInteractiveRefreshSuppression();
                } else {
                    this.silenceRefreshEvents();
                }
                const session = await this.getSession(scopeListOrRequest, tenant.tenantId, { ...(createIfNone ? { createIfNone: true } : { silent: true }), account: tenant.account });
                if (createIfNone) {
                    this.silenceRefreshEvents();
                }
                if (!session) {
                    throw new NotSignedInError();
                }
                return session;
            },
        };
    }
}
