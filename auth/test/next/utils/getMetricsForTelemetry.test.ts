/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mock } from 'node:test';
import { expect } from 'chai';
import type { AzureAccount } from '../../../src/next/contracts/AzureAccount';
import type { AzureTenant } from '../../../src/next/contracts/AzureTenant';
import { AzurePublicCloud } from '../../../src/next/contracts/EnvironmentLike';
import { getMetricsForTelemetry } from '../../../src/next/utils/getMetricsForTelemetry';

type Provider = Parameters<typeof getMetricsForTelemetry>[0];
type Subscription = Awaited<ReturnType<Provider['getAvailableSubscriptions']>>[number];

interface FakeProviderOptions {
    accounts?: AzureAccount[];
    accountsError?: Error;
    /** Maps an account id to the tenants returned for it, or an Error to reject with. */
    tenantsByAccount?: Record<string, AzureTenant[] | Error>;
    subscriptions?: Subscription[];
}

const testAccount = (id: string): AzureAccount => ({ id, label: `${id}@contoso.com`, environment: AzurePublicCloud });

function makeSubscriptions(count: number): Subscription[] {
    return Array.from({ length: count }, (_v, i) => ({ subscriptionId: `sub-${i}` } as unknown as Subscription));
}

function createFakeProvider(options: FakeProviderOptions = {}) {
    const getAccounts = mock.fn((): Promise<AzureAccount[]> =>
        options.accountsError ? Promise.reject(options.accountsError) : Promise.resolve(options.accounts ?? []));

    const getTenantsForAccount = mock.fn((account: AzureAccount): Promise<AzureTenant[]> => {
        const result = options.tenantsByAccount?.[account.id];
        if (result instanceof Error) {
            return Promise.reject(result);
        }
        return Promise.resolve(result ?? []);
    });

    const getAvailableSubscriptions = mock.fn((): Promise<Subscription[]> => Promise.resolve(options.subscriptions ?? []));

    const provider = { getAccounts, getTenantsForAccount, getAvailableSubscriptions } as unknown as Provider;
    return { provider, getAccounts, getTenantsForAccount, getAvailableSubscriptions };
}

const tenant = (tenantId: string, account: AzureAccount): AzureTenant => ({ tenantId, account });

describe('(unit) next/getMetricsForTelemetry', () => {
    it('aggregates account, tenant, and subscription counts', async () => {
        const accountA = testAccount('account-a');
        const accountB = testAccount('account-b');
        const { provider } = createFakeProvider({
            accounts: [accountA, accountB],
            tenantsByAccount: {
                'account-a': [tenant('t1', accountA), tenant('t2', accountA)],
                'account-b': [tenant('t3', accountB)],
            },
            subscriptions: makeSubscriptions(3),
        });

        const metrics = await getMetricsForTelemetry(provider);

        expect(metrics.totalAccounts).to.equal(2);
        expect(metrics.visibleTenants).to.equal(3);
        expect(metrics.visibleSubscriptions).to.equal(3);
        expect(JSON.parse(metrics.subscriptionIdList)).to.deep.equal(['sub-0', 'sub-1', 'sub-2']);
        expect(metrics.subscriptionIdListIsIncomplete).to.equal(false);
    });

    it('skips an account whose tenants cannot be retrieved instead of throwing', async () => {
        const accountA = testAccount('account-a');
        const accountB = testAccount('account-b');
        const { provider } = createFakeProvider({
            accounts: [accountA, accountB],
            tenantsByAccount: {
                'account-a': new Error('boom'),
                'account-b': [tenant('t1', accountB), tenant('t2', accountB)],
            },
        });

        const metrics = await getMetricsForTelemetry(provider);

        // The failing account contributes 0 tenants; the other still counts.
        expect(metrics.totalAccounts).to.equal(2);
        expect(metrics.visibleTenants).to.equal(2);
    });

    it('caps the subscription id list at 25 and flags it as incomplete', async () => {
        const { provider } = createFakeProvider({
            accounts: [testAccount('account-a')],
            subscriptions: makeSubscriptions(30),
        });

        const metrics = await getMetricsForTelemetry(provider);

        expect(metrics.visibleSubscriptions).to.equal(30);
        expect(JSON.parse(metrics.subscriptionIdList)).to.have.lengthOf(25);
        expect(metrics.subscriptionIdListIsIncomplete).to.equal(true);
    });

    it('reports an incomplete-of-false when there are exactly 25 subscriptions', async () => {
        const { provider } = createFakeProvider({
            accounts: [testAccount('account-a')],
            subscriptions: makeSubscriptions(25),
        });

        const metrics = await getMetricsForTelemetry(provider);

        expect(JSON.parse(metrics.subscriptionIdList)).to.have.lengthOf(25);
        expect(metrics.subscriptionIdListIsIncomplete).to.equal(false);
    });

    it('propagates the error from getAccounts when not signed in', async () => {
        const { provider, getTenantsForAccount } = createFakeProvider({ accountsError: new Error('not signed in') });

        let thrown: unknown;
        try {
            await getMetricsForTelemetry(provider);
        } catch (err) {
            thrown = err;
        }

        expect(thrown).to.be.instanceOf(Error);
        expect((thrown as Error).message).to.equal('not signed in');
        // The pipeline short-circuits before querying tenants.
        expect(getTenantsForAccount.mock.callCount()).to.equal(0);
    });
});
