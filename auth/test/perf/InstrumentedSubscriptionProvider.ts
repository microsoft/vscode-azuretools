/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionClient } from '@azure/arm-resources-subscriptions';
import type { TokenCredential } from '@azure/core-auth';
import type { AzureAccount } from '../../src/contracts/AzureAccount';
import type { AzureAuthentication } from '../../src/contracts/AzureAuthentication';
import type { AzureSubscription } from '../../src/contracts/AzureSubscription';
import type { TenantIdAndAccount } from '../../src/contracts/AzureSubscriptionProvider';
import type { GetAccountsOptions, GetAvailableSubscriptionsOptions, GetSubscriptionsForTenantOptions, GetTenantsForAccountOptions } from '../../src/contracts/AzureSubscriptionProviderRequestOptions';
import type { AzureTenant } from '../../src/contracts/AzureTenant';
import { VSCodeAzureSubscriptionProvider } from '../../src/providers/VSCodeAzureSubscriptionProvider';
import { instrumentCredential, PerfTracker } from './SubscriptionListingPerf';

/**
 * An instrumented version of {@link VSCodeAzureSubscriptionProvider} that records
 * detailed timing data for every phase of subscription listing:
 *
 * - `vscode.authentication.getAccounts` — VSCode API to discover accounts
 * - `getToken` — VSCode token acquisition (credential.getToken calls made
 *   by the ARM SDK, which internally call `vscode.authentication.getSession`)
 * - `ARM tenants.list` — ARM REST call to list tenants
 * - `ARM subscriptions.list` — ARM REST call to list subscriptions
 * - `import arm-resources-subscriptions` — dynamic module import
 *
 * Use {@link tracker} to retrieve spans and print reports after calling
 * `getAvailableSubscriptions()`.
 */
export class InstrumentedSubscriptionProvider extends VSCodeAzureSubscriptionProvider {
    public readonly tracker = new PerfTracker();

    // ── getAccounts ──────────────────────────────────────────────────────

    public override async getAccounts(options?: GetAccountsOptions): Promise<AzureAccount[]> {
        return this.tracker.measure('getAccounts (total)', () => super.getAccounts(options));
    }

    // ── getTenantsForAccount ─────────────────────────────────────────────

    public override async getTenantsForAccount(account: AzureAccount, options?: GetTenantsForAccountOptions): Promise<AzureTenant[]> {
        const screenId = account.id.substring(0, 4) + '…';
        return this.tracker.measure(
            'getTenantsForAccount (total)',
            () => super.getTenantsForAccount(account, options),
            { meta: { account: screenId } },
        );
    }

    // ── getSubscriptionsForTenant ────────────────────────────────────────

    public override async getSubscriptionsForTenant(tenant: TenantIdAndAccount, options?: GetSubscriptionsForTenantOptions): Promise<AzureSubscription[]> {
        const screenId = tenant.account.id.substring(0, 4) + '…';
        const tenantShort = tenant.tenantId.substring(0, 8) + '…';
        return this.tracker.measure(
            'getSubscriptionsForTenant (total)',
            () => super.getSubscriptionsForTenant(tenant, options),
            { meta: { account: screenId, tenant: tenantShort } },
        );
    }

    // ── getAvailableSubscriptions ────────────────────────────────────────

    public override async getAvailableSubscriptions(options?: GetAvailableSubscriptionsOptions): Promise<AzureSubscription[]> {
        this.tracker.reset();
        return this.tracker.measure(
            'getAvailableSubscriptions (end-to-end)',
            () => super.getAvailableSubscriptions(options),
        );
    }

    // ── getSubscriptionClient (wraps credential with timing) ─────────────

    protected override async getSubscriptionClient(tenant: Partial<TenantIdAndAccount>): Promise<{
        client: SubscriptionClient;
        credential: TokenCredential;
        authentication: AzureAuthentication;
    }> {
        const result = await this.tracker.measure(
            'getSubscriptionClient',
            () => super.getSubscriptionClient(tenant),
            { meta: { tenant: tenant.tenantId?.substring(0, 8) ?? '(home)' } },
        );

        const tenantLabel = tenant.tenantId
            ? `tenant ${tenant.tenantId.substring(0, 8)}…`
            : 'home tenant';

        // Wrap the credential so we capture every getToken call the ARM SDK makes.
        // Each getToken internally calls getSessionFromVSCode, so this times
        // both the VSCode token acquisition and the token return.
        const instrumentedCredential = instrumentCredential(result.credential, this.tracker, tenantLabel);

        // Wrap authentication.getSession / getSessionWithScopes — these also
        // call getSessionFromVSCode and are used by consumer code after listing.
        const origAuth = result.authentication;
        const instrumentedAuth: AzureAuthentication = {
            getSession: () =>
                this.tracker.measure(
                    'getSessionFromVSCode (auth.getSession)',
                    () => Promise.resolve(origAuth.getSession()),
                    { parent: 'getSubscriptionClient', meta: { tenant: tenantLabel } },
                ),
            getSessionWithScopes: (scopeListOrRequest) =>
                this.tracker.measure(
                    'getSessionFromVSCode (auth.getSessionWithScopes)',
                    () => Promise.resolve(origAuth.getSessionWithScopes(scopeListOrRequest)),
                    { parent: 'getSubscriptionClient', meta: { tenant: tenantLabel } },
                ),
        };

        return {
            client: result.client,
            credential: instrumentedCredential,
            authentication: instrumentedAuth,
        };
    }
}
