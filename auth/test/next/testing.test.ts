/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/core-auth';
import type { HttpClient, PipelineRequest, PipelineResponse } from '@azure/core-rest-pipeline';
import type * as vscode from 'vscode';
import type { AzureSubscriptionProviderOptions } from '../../src/next/AzureSubscriptionProviderBase';
import { isNotSignedInError } from '../../src/next/utils/NotSignedInError';
import { AzureDevOpsCredential, AzureDevOpsSubscriptionProvider, type ResolvedAzureDevOpsCredentialInit } from '../../src/next/testing';

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

function createFakeVsCode(): AzureSubscriptionProviderOptions['vscode'] {
    return {
        authentication: {
            getAccounts: () => Promise.resolve([]),
            getSession: () => Promise.resolve(undefined),
            onDidChangeSessions: () => ({ dispose: () => { /* noop */ } }),
        },
        workspace: {
            getConfiguration: () => ({
                get: <T>(_key: string, defaultValue?: T): T => defaultValue as T,
                update: () => Promise.resolve(),
            }),
            onDidChangeConfiguration: () => ({ dispose: () => { /* noop */ } }),
        },
        l10n: { t: (message: string): string => message },
        EventEmitter: FakeEventEmitter,
        Disposable: class { public dispose(): void { /* noop */ } },
        CancellationError: class extends Error { },
        ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
    } as unknown as AzureSubscriptionProviderOptions['vscode'];
}

function fakeTokenCredential(token: string = 'devops-token'): TokenCredential {
    return {
        getToken: (_scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken> =>
            Promise.resolve({ token, expiresOnTimestamp: Date.now() + 3600 * 1000 }),
    };
}

async function createFakeHttpClient(body: unknown): Promise<HttpClient> {
    const { createHttpHeaders } = await import('@azure/core-rest-pipeline');
    return {
        sendRequest: (request: PipelineRequest): Promise<PipelineResponse> => Promise.resolve({
            request,
            status: 200,
            headers: createHttpHeaders({ 'content-type': 'application/json' }),
            bodyAsText: JSON.stringify(body),
        }),
    };
}

const baseInit = { serviceConnectionId: 'service-connection', tenantId: 'tenant-1', clientId: 'client-1' };

// #endregion

suite('(unit) next/testing', () => {
    suite('AzureDevOpsCredential', () => {
        test('throws when required initializer values are missing', () => {
            assert.throws(() => new AzureDevOpsCredential({ serviceConnectionId: '', tenantId: 't', clientId: 'c' }));
            assert.throws(() => new AzureDevOpsCredential({ serviceConnectionId: 's', tenantId: '', clientId: 'c' }));
            assert.throws(() => new AzureDevOpsCredential({ serviceConnectionId: 's', tenantId: 't', clientId: '' }));
        });

        test('uses the provided credentialFactory and forwards the resolved init', async () => {
            let received: ResolvedAzureDevOpsCredentialInit | undefined;
            const credential = new AzureDevOpsCredential({
                ...baseInit,
                systemAccessToken: 'system-token',
                credentialFactory: (init) => {
                    received = init;
                    return fakeTokenCredential('from-factory');
                },
            });

            const token = await credential.getToken('https://management.azure.com/.default');

            assert.strictEqual(token?.token, 'from-factory');
            assert.ok(received);
            assert.strictEqual(received.serviceConnectionId, 'service-connection');
            assert.strictEqual(received.tenantId, 'tenant-1');
            assert.strictEqual(received.clientId, 'client-1');
            assert.strictEqual(received.systemAccessToken, 'system-token');
        });

        test('throws when a credentialFactory is provided but no system access token is available', async () => {
            const previous = process.env.SYSTEM_ACCESSTOKEN;
            delete process.env.SYSTEM_ACCESSTOKEN;
            try {
                const credential = new AzureDevOpsCredential({
                    ...baseInit,
                    credentialFactory: () => fakeTokenCredential(),
                });
                await assert.rejects(() => credential.getToken('scope'));
            } finally {
                if (previous !== undefined) {
                    process.env.SYSTEM_ACCESSTOKEN = previous;
                }
            }
        });

        test('lazily creates the inner credential only once', async () => {
            let factoryCalls = 0;
            const credential = new AzureDevOpsCredential({
                ...baseInit,
                systemAccessToken: 'system-token',
                credentialFactory: () => {
                    factoryCalls++;
                    return fakeTokenCredential();
                },
            });

            await credential.getToken('scope');
            await credential.getToken('scope');

            assert.strictEqual(factoryCalls, 1);
        });
    });

    suite('AzureDevOpsSubscriptionProvider', () => {
        function createProvider(httpClient?: HttpClient): AzureDevOpsSubscriptionProvider {
            return new AzureDevOpsSubscriptionProvider({
                ...baseInit,
                vscode: createFakeVsCode(),
                httpClient,
                systemAccessToken: 'system-token',
                credentialFactory: () => fakeTokenCredential(),
            });
        }

        test('returns a single fixed account in the public cloud', async () => {
            const provider = createProvider();
            const accounts = await provider.getAccounts();
            assert.strictEqual(accounts.length, 1);
            assert.strictEqual(accounts[0].id, 'test-account-id');
            assert.strictEqual(accounts[0].environment.name, 'AzureCloud');
            provider.dispose();
        });

        test('returns the single configured tenant for the account', async () => {
            const provider = createProvider();
            const [account] = await provider.getAccounts();
            const tenants = await provider.getTenantsForAccount(account);
            assert.strictEqual(tenants.length, 1);
            assert.strictEqual(tenants[0].tenantId, 'tenant-1');
            provider.dispose();
        });

        test('returns no unauthenticated tenants', async () => {
            const provider = createProvider();
            assert.deepStrictEqual(await provider.getUnauthenticatedTenantsForAccount(), []);
            provider.dispose();
        });

        test('onRefreshSuggested never fires but returns a disposable', () => {
            const provider = createProvider();
            const disposable = provider.onRefreshSuggested();
            assert.ok(typeof disposable.dispose === 'function');
            disposable.dispose();
            provider.dispose();
        });

        test('throws NotSignedInError when listing subscriptions before signIn', async () => {
            const httpClient = await createFakeHttpClient({ value: [] });
            const provider = createProvider(httpClient);
            const [account] = await provider.getAccounts();
            await assert.rejects(
                () => provider.getSubscriptionsForTenant({ tenantId: 'tenant-1', account }),
                (err) => isNotSignedInError(err),
            );
            provider.dispose();
        });

        test('signs in and lists subscriptions through the federated credential', async () => {
            const httpClient = await createFakeHttpClient({
                value: [{ subscriptionId: 'sub-1', displayName: 'DevOps Sub', tenantId: 'tenant-1', state: 'Enabled' }],
            });
            const provider = createProvider(httpClient);

            assert.strictEqual(await provider.signIn(), true);

            const [account] = await provider.getAccounts();
            const subs = await provider.getSubscriptionsForTenant({ tenantId: 'tenant-1', account });

            assert.strictEqual(subs.length, 1);
            assert.strictEqual(subs[0].subscriptionId, 'sub-1');
            assert.strictEqual(subs[0].name, 'DevOps Sub');
            assert.ok(typeof subs[0].credential.getToken === 'function');
            provider.dispose();
        });
    });
});
