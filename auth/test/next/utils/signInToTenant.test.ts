/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mock } from 'node:test';
import { expect } from 'chai';
import type * as vscode from 'vscode';
import type { AzureAccount } from '../../../src/next/contracts/AzureAccount';
import type { AzureSubscriptionProvider, TenantIdAndAccount } from '../../../src/next/contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../../../src/next/contracts/AzureTenant';
import { AzurePublicCloud } from '../../../src/next/contracts/EnvironmentLike';
import { signInToTenant, type SignInToTenantContext } from '../../../src/next/utils/signInToTenant';

interface TenantPick {
    label: string;
    description: string;
    detail: string;
    tenant: TenantIdAndAccount;
}

const testAccount = (id: string, label: string = `${id}@contoso.com`): AzureAccount => ({ id, label, environment: AzurePublicCloud });

const tenant = (tenantId: string, account: AzureAccount, displayName?: string, defaultDomain?: string): AzureTenant =>
    ({ tenantId, account, displayName, defaultDomain });

interface ProviderOptions {
    accounts?: AzureAccount[];
    tenantsByAccount?: Record<string, AzureTenant[]>;
}

function createProvider(options: ProviderOptions = {}) {
    const getAccounts = mock.fn((): Promise<AzureAccount[]> => Promise.resolve(options.accounts ?? []));
    const getUnauthenticatedTenantsForAccount = mock.fn((account: AzureAccount): Promise<AzureTenant[]> =>
        Promise.resolve(options.tenantsByAccount?.[account.id] ?? []));
    const signIn = mock.fn((_tenant?: TenantIdAndAccount): Promise<boolean> => Promise.resolve(true));

    const provider = { getAccounts, getUnauthenticatedTenantsForAccount, signIn } as unknown as AzureSubscriptionProvider;
    return { provider, getAccounts, getUnauthenticatedTenantsForAccount, signIn };
}

/**
 * Builds a {@link SignInToTenantContext} whose `showQuickPick` resolves the offered items, captures them
 * for inspection, and returns whatever `selector` chooses (defaulting to the first item).
 */
function createContext(selector: (items: TenantPick[]) => TenantPick | undefined = items => items[0]) {
    let captured: TenantPick[] = [];
    const showQuickPick = mock.fn(async (items: Thenable<TenantPick[]>, _options?: vscode.QuickPickOptions) => {
        captured = await items;
        return selector(captured);
    });
    const t = mock.fn((message: string) => message);

    const context = { window: { showQuickPick }, l10n: { t } } as unknown as SignInToTenantContext;
    return { context, showQuickPick, t, items: () => captured };
}

describe('(unit) next/signInToTenant', () => {
    it('signs in to the picked tenant', async () => {
        const account = testAccount('account-a');
        const targetTenant = tenant('tenant-1', account, 'Tenant One');
        const { provider, signIn } = createProvider({ tenantsByAccount: { 'account-a': [targetTenant] } });
        const { context } = createContext();

        await signInToTenant(context, provider, account);

        expect(signIn.mock.callCount()).to.equal(1);
        expect(signIn.mock.calls[0].arguments[0]).to.equal(targetTenant);
    });

    it('does not sign in when the quick pick is dismissed', async () => {
        const account = testAccount('account-a');
        const { provider, signIn } = createProvider({ tenantsByAccount: { 'account-a': [tenant('tenant-1', account, 'One')] } });
        const { context } = createContext(() => undefined);

        await signInToTenant(context, provider, account);

        expect(signIn.mock.callCount()).to.equal(0);
    });

    it('lists tenants for the supplied account without calling getAccounts', async () => {
        const account = testAccount('account-a');
        const { provider, getAccounts, getUnauthenticatedTenantsForAccount } = createProvider({
            tenantsByAccount: { 'account-a': [tenant('tenant-1', account, 'One')] },
        });
        const { context, items } = createContext();

        await signInToTenant(context, provider, account);

        expect(getAccounts.mock.callCount()).to.equal(0);
        expect(getUnauthenticatedTenantsForAccount.mock.callCount()).to.equal(1);
        expect(items().map(i => i.tenant.tenantId)).to.deep.equal(['tenant-1']);
    });

    it('aggregates unauthenticated tenants across all accounts when none is supplied', async () => {
        const accountA = testAccount('account-a');
        const accountB = testAccount('account-b');
        const { provider, getAccounts } = createProvider({
            accounts: [accountA, accountB],
            tenantsByAccount: {
                'account-a': [tenant('tenant-1', accountA, 'One')],
                'account-b': [tenant('tenant-2', accountB, 'Two')],
            },
        });
        const { context, items } = createContext();

        await signInToTenant(context, provider);

        expect(getAccounts.mock.callCount()).to.equal(1);
        expect(items().map(i => i.tenant.tenantId).sort()).to.deep.equal(['tenant-1', 'tenant-2']);
    });

    it('sorts picks by display name and maps label/description/detail', async () => {
        const account = testAccount('account-a');
        const { provider } = createProvider({
            tenantsByAccount: {
                'account-a': [
                    tenant('tenant-z', account, 'Zeta', 'zeta.example'),
                    tenant('tenant-a', account, 'Alpha', 'alpha.example'),
                ],
            },
        });
        const { context, items } = createContext();

        await signInToTenant(context, provider, account);

        const picks = items();
        expect(picks.map(i => i.label)).to.deep.equal(['Alpha', 'Zeta']);
        expect(picks[0].description).to.equal('tenant-a');
        expect(picks[0].detail).to.equal('alpha.example');
    });

    it('appends the account label to the description for duplicate tenant ids', async () => {
        const accountA = testAccount('account-a', 'a@contoso.com');
        const accountB = testAccount('account-b', 'b@contoso.com');
        const { provider } = createProvider({
            accounts: [accountA, accountB],
            tenantsByAccount: {
                'account-a': [tenant('shared-tenant', accountA, 'Shared')],
                'account-b': [tenant('shared-tenant', accountB, 'Shared')],
            },
        });
        const { context, items } = createContext();

        await signInToTenant(context, provider);

        // Both picks share the tenant id, so each description is disambiguated with its account label.
        const descriptions = items().map(i => i.description).sort();
        expect(descriptions).to.deep.equal([
            'shared-tenant (a@contoso.com)',
            'shared-tenant (b@contoso.com)',
        ]);
    });

    it('localizes the quick pick placeholder via the injected l10n namespace', async () => {
        const account = testAccount('account-a');
        const { provider } = createProvider({ tenantsByAccount: { 'account-a': [tenant('tenant-1', account, 'One')] } });
        const { context, t, showQuickPick } = createContext();

        await signInToTenant(context, provider, account);

        expect(t.mock.callCount()).to.equal(1);
        expect(showQuickPick.mock.calls[0].arguments[1]?.placeHolder).to.equal('Select a Tenant (Directory) to Sign In To');
    });
});
