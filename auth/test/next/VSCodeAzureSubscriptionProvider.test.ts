/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mock } from 'node:test';
import { expect } from 'chai';
import { createHttpHeaders, type HttpClient, type PipelineRequest, type PipelineResponse } from '@azure/core-rest-pipeline';
import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/core-auth';
import type * as vscode from 'vscode';
import { VSCodeAzureSubscriptionProvider } from '../../src/next/VSCodeAzureSubscriptionProvider';
import type { AzureSubscriptionProviderOptions } from '../../src/next/AzureSubscriptionProviderBase';
import { CustomCloudConfigurationSection } from '../../src/next/configuredEnvironment';
import type { AzureAccount } from '../../src/next/contracts/AzureAccount';
import { AzurePublicCloud } from '../../src/next/contracts/EnvironmentLike';

// #region Fakes

class FakeEventEmitter<T> {
    private readonly listeners = new Set<(e: T) => unknown>();
    public event = (listener: (e: T) => unknown): vscode.Disposable => {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    };
    public fire(data: T): void {
        for (const l of this.listeners) {
            l(data);
        }
    }
    public dispose(): void {
        this.listeners.clear();
    }
}

class FakeCancellationError extends Error {
    constructor() {
        super('Canceled');
        this.name = 'Canceled';
    }
}

interface FakeVsCodeOptions {
    accounts?: vscode.AuthenticationSessionAccountInformation[];
    tenants?: Array<{ tenantId: string; displayName?: string }>;
    subscriptions?: Array<{ subscriptionId: string; displayName: string; tenantId: string; state?: string }>;
    configuration?: Record<string, Record<string, unknown>>;
}

function createFakeVsCode(options: FakeVsCodeOptions = {}) {
    const config = options.configuration ?? {};

    const getAccounts = mock.fn((_providerId: string) => Promise.resolve(options.accounts ?? []));
    const getSession = mock.fn(() => Promise.resolve({ accessToken: 'tok' } as vscode.AuthenticationSession));
    const onDidChangeSessions = mock.fn((_listener: (e: unknown) => unknown) => ({ dispose: () => { /* noop */ } }));

    const configListenerDispose = mock.fn();
    const onDidChangeConfiguration = mock.fn((_listener: (e: vscode.ConfigurationChangeEvent) => unknown) => ({ dispose: configListenerDispose }));

    const vscodeShim = {
        authentication: { getAccounts, getSession, onDidChangeSessions },
        workspace: {
            getConfiguration: (section?: string) => ({
                get: <T>(key: string, defaultValue?: T): T => {
                    const sectionConfig = config[section ?? ''] ?? {};
                    return (key in sectionConfig ? sectionConfig[key] as T : defaultValue as T);
                },
                update: () => Promise.resolve(),
            }),
            onDidChangeConfiguration,
        },
        l10n: {
            t: (message: string, ...args: unknown[]): string => message.replace(/\{(\d+)\}/g, (_m, i) => String(args[Number(i)])),
        },
        EventEmitter: FakeEventEmitter,
        Disposable: class { public dispose(): void { /* noop */ } },
        CancellationError: FakeCancellationError,
        ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
    } as unknown as AzureSubscriptionProviderOptions['vscode'];

    const sendRequest = mock.fn((request: PipelineRequest): Promise<PipelineResponse> => {
        const url = request.url;
        let body: unknown = { value: [] };
        if (url.includes('/tenants')) {
            body = { value: options.tenants ?? [] };
        } else if (url.includes('/subscriptions')) {
            body = { value: options.subscriptions ?? [] };
        }
        return Promise.resolve({
            request,
            status: 200,
            headers: createHttpHeaders({ 'content-type': 'application/json' }),
            bodyAsText: JSON.stringify(body),
        });
    });
    const httpClient: HttpClient = { sendRequest };

    const countRequests = (fragment: string): number =>
        sendRequest.mock.calls.filter(c => c.arguments[0].url.includes(fragment)).length;

    return {
        vscode: vscodeShim,
        httpClient,
        getAccountsCount: () => getAccounts.mock.callCount(),
        tenantsRequestCount: () => countRequests('/tenants'),
        subscriptionsRequestCount: () => countRequests('/subscriptions'),
        fireSessionChange: (providerId: string) => onDidChangeSessions.mock.calls.at(-1)?.arguments[0]({ provider: { id: providerId } }),
        fireConfigChange: (affects: (section: string) => boolean) => onDidChangeConfiguration.mock.calls.at(-1)?.arguments[0]({ affectsConfiguration: affects }),
        configListenerDisposed: () => configListenerDispose.mock.callCount() > 0,
    };
}

function fakeTokenCredential(token: string = 'fake-token'): TokenCredential {
    return {
        getToken: (_scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken> =>
            Promise.resolve({ token, expiresOnTimestamp: Date.now() + 3600 * 1000 }),
    };
}

const testAccount = (id: string = 'account-1', label: string = 'user@contoso.com'): AzureAccount => ({ id, label, environment: AzurePublicCloud });

// Exposes the protected refresh hook so the cache-clearing override can be tested in isolation.
class ExposingProvider extends VSCodeAzureSubscriptionProvider {
    public fire(evtArgs: Parameters<VSCodeAzureSubscriptionProvider['fireRefreshSuggestedIfNeeded']>[0]): boolean {
        return this.fireRefreshSuggestedIfNeeded(evtArgs);
    }
}

// Counts how many times the (cached) getAccounts method is invoked, to distinguish promise coalescence
// from plain caching.
class CountingProvider extends VSCodeAzureSubscriptionProvider {
    public getAccountsCalls = 0;
    public override getAccounts(options?: Parameters<VSCodeAzureSubscriptionProvider['getAccounts']>[0]): Promise<AzureAccount[]> {
        this.getAccountsCalls++;
        return super.getAccounts(options);
    }
}

// #endregion

describe('(unit) next/VSCodeAzureSubscriptionProvider', () => {
    describe('account caching', () => {
        it('fetches accounts once and serves subsequent calls from cache', async () => {
            const fake = createFakeVsCode({ accounts: [testAccount()] });
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential() });

            await provider.getAccounts();
            await provider.getAccounts();

            expect(fake.getAccountsCount()).to.equal(1);
            provider.dispose();
        });

        it('bypasses the cache when noCache is set', async () => {
            const fake = createFakeVsCode({ accounts: [testAccount()] });
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential() });

            await provider.getAccounts();
            await provider.getAccounts({ noCache: true });

            expect(fake.getAccountsCount()).to.equal(2);
            provider.dispose();
        });
    });

    describe('tenant caching and filtering', () => {
        it('caches tenants per account', async () => {
            const fake = createFakeVsCode({ tenants: [{ tenantId: 'tenant-a', displayName: 'A' }] });
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential(), httpClient: fake.httpClient });

            await provider.getTenantsForAccount(testAccount(), { filter: false });
            await provider.getTenantsForAccount(testAccount(), { filter: false });

            expect(fake.tenantsRequestCount()).to.equal(1);
            provider.dispose();
        });

        it('filters tenants to those configured in selectedSubscriptions', async () => {
            const fake = createFakeVsCode({
                tenants: [{ tenantId: 'tenant-a', displayName: 'A' }, { tenantId: 'tenant-b', displayName: 'B' }],
                configuration: { azureResourceGroups: { selectedSubscriptions: ['tenant-a/sub-1'] } },
            });
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential(), httpClient: fake.httpClient });

            const tenants = await provider.getTenantsForAccount(testAccount());

            expect(tenants.map(t => t.tenantId)).to.deep.equal(['tenant-a']);
            provider.dispose();
        });

        it('re-fetches tenants when noCache is set', async () => {
            const fake = createFakeVsCode({ tenants: [{ tenantId: 'tenant-a', displayName: 'A' }] });
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential(), httpClient: fake.httpClient });

            await provider.getTenantsForAccount(testAccount(), { filter: false });
            await provider.getTenantsForAccount(testAccount(), { filter: false, noCache: true });

            expect(fake.tenantsRequestCount()).to.equal(2);
            provider.dispose();
        });

        it('sorts tenants by display name', async () => {
            const fake = createFakeVsCode({
                tenants: [{ tenantId: 'tenant-z', displayName: 'Zeta' }, { tenantId: 'tenant-a', displayName: 'Alpha' }],
            });
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential(), httpClient: fake.httpClient });

            const tenants = await provider.getTenantsForAccount(testAccount(), { filter: false });

            expect(tenants.map(t => t.displayName)).to.deep.equal(['Alpha', 'Zeta']);
            provider.dispose();
        });
    });

    describe('subscription caching, filtering and dedupe', () => {
        it('caches subscriptions per account+tenant', async () => {
            const fake = createFakeVsCode({ subscriptions: [{ subscriptionId: 'sub-1', displayName: 'One', tenantId: 'tenant-a', state: 'Enabled' }] });
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential(), httpClient: fake.httpClient });

            const tenant = { tenantId: 'tenant-a', account: testAccount() };
            await provider.getSubscriptionsForTenant(tenant, { filter: false });
            await provider.getSubscriptionsForTenant(tenant, { filter: false });

            expect(fake.subscriptionsRequestCount()).to.equal(1);
            provider.dispose();
        });

        it('filters subscriptions to those configured in selectedSubscriptions', async () => {
            const fake = createFakeVsCode({
                subscriptions: [
                    { subscriptionId: 'sub-1', displayName: 'One', tenantId: 'tenant-a', state: 'Enabled' },
                    { subscriptionId: 'sub-2', displayName: 'Two', tenantId: 'tenant-a', state: 'Enabled' },
                ],
                configuration: { azureResourceGroups: { selectedSubscriptions: ['tenant-a/sub-1'] } },
            });
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential(), httpClient: fake.httpClient });

            const subs = await provider.getSubscriptionsForTenant({ tenantId: 'tenant-a', account: testAccount() });

            expect(subs.map(s => s.subscriptionId)).to.deep.equal(['sub-1']);
            provider.dispose();
        });

        it('re-fetches subscriptions when noCache is set', async () => {
            const fake = createFakeVsCode({ subscriptions: [{ subscriptionId: 'sub-1', displayName: 'One', tenantId: 'tenant-a', state: 'Enabled' }] });
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential(), httpClient: fake.httpClient });

            const tenant = { tenantId: 'tenant-a', account: testAccount() };
            await provider.getSubscriptionsForTenant(tenant, { filter: false });
            await provider.getSubscriptionsForTenant(tenant, { filter: false, noCache: true });

            expect(fake.subscriptionsRequestCount()).to.equal(2);
            provider.dispose();
        });

        it('sorts subscriptions by name', async () => {
            const fake = createFakeVsCode({
                subscriptions: [
                    { subscriptionId: 'sub-z', displayName: 'Zeta', tenantId: 'tenant-a', state: 'Enabled' },
                    { subscriptionId: 'sub-a', displayName: 'Alpha', tenantId: 'tenant-a', state: 'Enabled' },
                ],
            });
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential(), httpClient: fake.httpClient });

            const subs = await provider.getSubscriptionsForTenant({ tenantId: 'tenant-a', account: testAccount() }, { filter: false });

            expect(subs.map(s => s.name)).to.deep.equal(['Alpha', 'Zeta']);
            provider.dispose();
        });
    });

    describe('getAvailableSubscriptions coalescing', () => {
        it('coalesces concurrent calls into a single underlying run', async () => {
            const fake = createFakeVsCode({
                accounts: [testAccount()],
                tenants: [{ tenantId: 'tenant-a', displayName: 'A' }],
                subscriptions: [{ subscriptionId: 'sub-1', displayName: 'One', tenantId: 'tenant-a', state: 'Enabled' }],
            });
            const provider = new CountingProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential(), httpClient: fake.httpClient });

            const [a, b] = await Promise.all([provider.getAvailableSubscriptions(), provider.getAvailableSubscriptions()]);

            expect(a.map(s => s.subscriptionId)).to.deep.equal(['sub-1']);
            expect(b.map(s => s.subscriptionId)).to.deep.equal(['sub-1']);
            // Both concurrent calls shared one underlying run.
            expect(provider.getAccountsCalls).to.equal(1);
            provider.dispose();
        });

        it('removes the coalescence entry once settled so later calls run again', async () => {
            const fake = createFakeVsCode({
                accounts: [testAccount()],
                tenants: [{ tenantId: 'tenant-a', displayName: 'A' }],
                subscriptions: [{ subscriptionId: 'sub-1', displayName: 'One', tenantId: 'tenant-a', state: 'Enabled' }],
            });
            const provider = new CountingProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential(), httpClient: fake.httpClient });

            await provider.getAvailableSubscriptions();
            await provider.getAvailableSubscriptions();

            // Two sequential (non-overlapping) calls each run the pipeline.
            expect(provider.getAccountsCalls).to.equal(2);
            provider.dispose();
        });
    });

    describe('onRefreshSuggested config listener', () => {
        it('fires a subscriptionFilterChange when the selected subscriptions setting changes', () => {
            const fake = createFakeVsCode();
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential() });

            const reasons: string[] = [];
            provider.onRefreshSuggested(e => reasons.push(e.reason));

            fake.fireConfigChange(section => section === 'azureResourceGroups.selectedSubscriptions');

            expect(reasons).to.deep.equal(['subscriptionFilterChange']);
            provider.dispose();
        });

        it('clears caches and fires a cloudChange when the cloud environment setting changes', async () => {
            const originalSetTimeout = global.setTimeout;
            const pending: Array<() => void> = [];
            (global as unknown as { setTimeout: unknown }).setTimeout = ((cb: () => void) => { pending.push(cb); return 0; });

            try {
                const fake = createFakeVsCode({ accounts: [testAccount()] });
                const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential() });

                const reasons: string[] = [];
                provider.onRefreshSuggested(e => reasons.push(e.reason));

                await provider.getAccounts(); // fill the account cache (1 fetch), schedules a silence timer
                pending.forEach(cb => { cb(); }); // run the silence callback so events are no longer suppressed
                fake.fireConfigChange(section => section === CustomCloudConfigurationSection);
                await provider.getAccounts(); // cache was cleared, so this re-fetches (2 fetches)

                expect(reasons).to.deep.equal(['cloudChange']);
                expect(fake.getAccountsCount()).to.equal(2);
                provider.dispose();
            } finally {
                global.setTimeout = originalSetTimeout;
            }
        });
    });

    describe('dispose', () => {
        it('disposes the configuration change listener', () => {
            const fake = createFakeVsCode();
            const provider = new VSCodeAzureSubscriptionProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential() });

            provider.onRefreshSuggested(() => { /* noop */ });
            provider.dispose();

            expect(fake.configListenerDisposed()).to.equal(true);
        });
    });

    describe('fireRefreshSuggestedIfNeeded', () => {
        it('clears the account cache when a sessionChange is fired', async () => {
            const originalSetTimeout = global.setTimeout;
            const pending: Array<() => void> = [];
            // Capture the refresh-silence timer so we can clear suppression deterministically.
            (global as unknown as { setTimeout: unknown }).setTimeout = ((cb: () => void) => { pending.push(cb); return 0; });

            try {
                const fake = createFakeVsCode({ accounts: [testAccount()] });
                const provider = new ExposingProvider({ vscode: fake.vscode, credentialFactory: () => fakeTokenCredential() });

                await provider.getAccounts(); // fill cache (1 fetch), schedules a silence timer
                pending.forEach(cb => { cb(); }); // run the silence callback so events are no longer suppressed

                const fired = provider.fire({ reason: 'sessionChange' });
                expect(fired).to.equal(true);

                await provider.getAccounts(); // account cache was cleared, so this re-fetches (2 fetches)
                expect(fake.getAccountsCount()).to.equal(2);
                provider.dispose();
            } finally {
                global.setTimeout = originalSetTimeout;
            }
        });
    });
});

