/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/core-auth';
import type { HttpClient, PipelineRequest, PipelineResponse } from '@azure/core-rest-pipeline';
import type * as vscode from 'vscode';
import { AzureSubscriptionProviderBase, type AzureSubscriptionProviderOptions } from '../../src/next/AzureSubscriptionProviderBase';
import type { AzureAccount } from '../../src/next/contracts/AzureAccount';
import { AzurePublicCloud } from '../../src/next/contracts/EnvironmentLike';
import { isNotSignedInError } from '../../src/next/utils/NotSignedInError';

// #region Fakes

interface GetSessionCall {
    providerId: string;
    scopeListOrRequest: readonly string[] | vscode.AuthenticationWwwAuthenticateRequest;
    options: vscode.AuthenticationGetSessionOptions | undefined;
}

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
    session?: Partial<vscode.AuthenticationSession> | undefined;
    configuration?: Record<string, Record<string, unknown>>;
}

function createFakeVsCode(options: FakeVsCodeOptions = {}) {
    const getSessionCalls: GetSessionCall[] = [];
    const accounts = options.accounts ?? [];
    const config = options.configuration ?? {};

    const vscodeShim = {
        authentication: {
            getAccounts: (_providerId: string) => Promise.resolve(accounts),
            getSession: (providerId: string, scopeListOrRequest: readonly string[] | vscode.AuthenticationWwwAuthenticateRequest, opts?: vscode.AuthenticationGetSessionOptions) => {
                getSessionCalls.push({ providerId, scopeListOrRequest, options: opts });
                return Promise.resolve(options.session as vscode.AuthenticationSession | undefined);
            },
            onDidChangeSessions: (_listener: unknown) => ({ dispose: () => { /* noop */ } }),
        },
        workspace: {
            getConfiguration: (section?: string) => ({
                get: <T>(key: string, defaultValue?: T): T => {
                    const sectionConfig = config[section ?? ''] ?? {};
                    return (key in sectionConfig ? sectionConfig[key] as T : defaultValue as T);
                },
                update: () => Promise.resolve(),
            }),
            onDidChangeConfiguration: (_listener: unknown) => ({ dispose: () => { /* noop */ } }),
        },
        l10n: {
            t: (message: string, ...args: unknown[]): string => message.replace(/\{(\d+)\}/g, (_m, i) => String(args[Number(i)])),
        },
        EventEmitter: FakeEventEmitter,
        Disposable: class { public dispose(): void { /* noop */ } },
        CancellationError: FakeCancellationError,
        ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
    } as unknown as AzureSubscriptionProviderOptions['vscode'];

    return { vscode: vscodeShim, getSessionCalls };
}

function fakeTokenCredential(token: string = 'fake-token'): TokenCredential {
    return {
        getToken: (_scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken> =>
            Promise.resolve({ token, expiresOnTimestamp: Date.now() + 3600 * 1000 }),
    };
}

function nullTokenCredential(): TokenCredential {
    return {
        getToken: (_scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken | null> =>
            Promise.resolve(null),
    };
}

interface FakeHttpRoute {
    /** A substring matched against the request URL path. */
    match: string;
    /** The JSON body to return (will be wrapped as `bodyAsText`). */
    body: unknown;
    status?: number;
}

/**
 * Creates a fake {@link HttpClient} that returns canned JSON for tenants/subscriptions requests. Optionally
 * returns a 401 challenge on the first matching request, then succeeds on retry.
 */
async function createFakeHttpClient(routes: FakeHttpRoute[], challengeOnce?: { match: string; wwwAuthenticate: string }): Promise<{ httpClient: HttpClient; challengeCount: () => number }> {
    const { createHttpHeaders } = await import('@azure/core-rest-pipeline');
    let challengesIssued = 0;
    const challengedUrls = new Set<string>();

    const httpClient: HttpClient = {
        sendRequest: (request: PipelineRequest): Promise<PipelineResponse> => {
            const url = request.url;

            if (challengeOnce && url.includes(challengeOnce.match) && !challengedUrls.has(url)) {
                challengedUrls.add(url);
                challengesIssued++;
                return Promise.resolve({
                    request,
                    status: 401,
                    headers: createHttpHeaders({ 'WWW-Authenticate': challengeOnce.wwwAuthenticate }),
                    bodyAsText: '',
                });
            }

            const route = routes.find(r => url.includes(r.match));
            return Promise.resolve({
                request,
                status: route?.status ?? 200,
                headers: createHttpHeaders({ 'content-type': 'application/json' }),
                bodyAsText: JSON.stringify(route?.body ?? { value: [] }),
            });
        },
    };

    return { httpClient, challengeCount: () => challengesIssued };
}

// A concrete subclass so we can instantiate the abstract base.
class TestSubscriptionProvider extends AzureSubscriptionProviderBase { }

// Mirrors the Azure DevOps provider: a credential-first source that cannot satisfy interactive challenges,
// so it overrides getTokenForChallenge to throw rather than prompting via VS Code's auth API.
class DevOpsStyleProvider extends AzureSubscriptionProviderBase {
    protected override getTokenForChallenge(): Promise<string | undefined> {
        throw new Error('Interactive challenges are not supported by this provider.');
    }
}

const testAccount = (id: string = 'account-1', label: string = 'user@contoso.com'): AzureAccount => ({ id, label, environment: AzurePublicCloud });

// #endregion

suite('(unit) next/AzureSubscriptionProviderBase', () => {
    suite('getAccounts', () => {
        test('maps accounts and attaches the configured environment', async () => {
            const { vscode } = createFakeVsCode({ accounts: [testAccount()] });
            const provider = new TestSubscriptionProvider({ vscode });

            const accounts = await provider.getAccounts();

            assert.strictEqual(accounts.length, 1);
            assert.strictEqual(accounts[0].id, 'account-1');
            assert.strictEqual(accounts[0].environment.name, 'AzureCloud');
            provider.dispose();
        });

        test('throws NotSignedInError when there are no accounts', async () => {
            const { vscode } = createFakeVsCode({ accounts: [] });
            const provider = new TestSubscriptionProvider({ vscode });

            await assert.rejects(() => provider.getAccounts(), (err) => isNotSignedInError(err));
            provider.dispose();
        });

        test('resolves the sovereign (China) environment from configuration', async () => {
            const { vscode } = createFakeVsCode({
                accounts: [testAccount()],
                configuration: { 'microsoft-sovereign-cloud': { environment: 'ChinaCloud' } },
            });
            const provider = new TestSubscriptionProvider({ vscode });

            const accounts = await provider.getAccounts();
            assert.strictEqual(accounts[0].environment.name, 'AzureChinaCloud');
            provider.dispose();
        });
    });

    suite('signIn', () => {
        test('returns true when a session is acquired', async () => {
            const { vscode } = createFakeVsCode({ session: { accessToken: 'tok' } });
            const provider = new TestSubscriptionProvider({ vscode });

            assert.strictEqual(await provider.signIn(), true);
            provider.dispose();
        });

        test('returns false when no session is acquired', async () => {
            const { vscode } = createFakeVsCode({ session: undefined });
            const provider = new TestSubscriptionProvider({ vscode });

            assert.strictEqual(await provider.signIn(), false);
            provider.dispose();
        });

        test('uses createIfNone for interactive sign-in and silent for non-interactive', async () => {
            const { vscode, getSessionCalls } = createFakeVsCode({ session: { accessToken: 'tok' } });
            const provider = new TestSubscriptionProvider({ vscode });

            await provider.signIn(undefined, { promptIfNeeded: true });
            assert.strictEqual(getSessionCalls[0].options?.createIfNone, true);

            await provider.signIn(undefined, { promptIfNeeded: false });
            assert.strictEqual(getSessionCalls[1].options?.silent, true);
            provider.dispose();
        });
    });

    suite('createCredentialForTenant', () => {
        test('returns the credential from the factory, wrapped with provider policy', async () => {
            const { vscode } = createFakeVsCode();
            const provider = new TestCredentialProvider({ vscode, credentialFactory: () => fakeTokenCredential('factory-token') });

            const credential = provider.exposeCredential({ tenantId: 't1', account: testAccount() });
            const token = await credential.getToken('scope');
            assert.strictEqual(token?.token, 'factory-token');
            provider.dispose();
        });

        test('throws when no credentialFactory was provided', () => {
            const { vscode } = createFakeVsCode();
            const provider = new TestCredentialProvider({ vscode });

            assert.throws(() => provider.exposeCredential({ tenantId: 't1', account: testAccount() }));
            provider.dispose();
        });

        test('throws NotSignedInError when the factory credential returns null for a silent token', async () => {
            const { vscode } = createFakeVsCode();
            const provider = new TestCredentialProvider({ vscode, credentialFactory: () => nullTokenCredential() });

            const credential = provider.exposeCredential({ tenantId: 't1', account: testAccount() });
            await assert.rejects(() => credential.getToken('scope'), (err) => isNotSignedInError(err));
            provider.dispose();
        });

        test('returns a token when the factory credential returns one', async () => {
            const { vscode } = createFakeVsCode();
            const provider = new TestCredentialProvider({ vscode, credentialFactory: () => fakeTokenCredential('session-token') });

            const credential = provider.exposeCredential({ tenantId: 't1', account: testAccount() });
            const token = await credential.getToken('https://management.azure.com/.default');
            assert.strictEqual(token?.token, 'session-token');
            provider.dispose();
        });

        test('does NOT throw on a null result for a CAE claims request (lets the policy handle it)', async () => {
            const { vscode } = createFakeVsCode();
            const provider = new TestCredentialProvider({ vscode, credentialFactory: () => nullTokenCredential() });

            const credential = provider.exposeCredential({ tenantId: 't1', account: testAccount() });
            const token = await credential.getToken('scope', { claims: '{"access_token":{"foo":"bar"}}' });
            assert.strictEqual(token, null);
            provider.dispose();
        });
    });

    suite('cancellation', () => {
        test('throws the injected CancellationError when the token is already cancelled', async () => {
            const { vscode } = createFakeVsCode({ accounts: [testAccount()] });
            const provider = new TestSubscriptionProvider({ vscode });
            const token = { isCancellationRequested: true, onCancellationRequested: () => ({ dispose: () => { /* noop */ } }) } as unknown as vscode.CancellationToken;

            await assert.rejects(() => provider.getAccounts({ token }), (err) => err instanceof FakeCancellationError);
            provider.dispose();
        });
    });

    suite('subscription listing (end-to-end through the SDK pipeline)', () => {
        test('lists and maps subscriptions for a tenant', async () => {
            const { vscode } = createFakeVsCode();
            const { httpClient } = await createFakeHttpClient([
                {
                    match: '/subscriptions',
                    body: {
                        value: [
                            { subscriptionId: 'sub-1', displayName: 'Subscription One', tenantId: 'tenant-1', state: 'Enabled' },
                            { subscriptionId: 'sub-2', displayName: 'Subscription Two', tenantId: 'tenant-1', state: 'Enabled' },
                        ],
                    },
                },
            ]);

            const provider = new TestSubscriptionProvider({ vscode, credentialFactory: () => fakeTokenCredential(), httpClient });

            const subs = await provider.getSubscriptionsForTenant({ tenantId: 'tenant-1', account: testAccount() });

            assert.strictEqual(subs.length, 2);
            assert.deepStrictEqual(subs.map(s => s.subscriptionId).sort(), ['sub-1', 'sub-2']);
            assert.strictEqual(subs[0].account.id, 'account-1');
            assert.strictEqual(subs[0].environment.name, 'AzureCloud');
            assert.strictEqual(subs[0].isCustomCloud, false);
            assert.ok(typeof subs[0].credential.getToken === 'function');
            // The new contract does not expose `authentication`.
            assert.ok(!('authentication' in subs[0]));
            provider.dispose();
        });

        test('lists tenants for an account', async () => {
            const { vscode } = createFakeVsCode();
            const { httpClient } = await createFakeHttpClient([
                {
                    match: '/tenants',
                    body: { value: [{ tenantId: 'tenant-1', displayName: 'Contoso' }, { tenantId: 'tenant-2', displayName: 'Fabrikam' }] },
                },
            ]);

            const provider = new TestSubscriptionProvider({ vscode, credentialFactory: () => fakeTokenCredential(), httpClient });

            const tenants = await provider.getTenantsForAccount(testAccount());
            assert.deepStrictEqual(tenants.map(t => t.tenantId).sort(), ['tenant-1', 'tenant-2']);
            provider.dispose();
        });

        test('retries with an interactive challenge token on a 401 WWW-Authenticate response', async () => {
            const { vscode, getSessionCalls } = createFakeVsCode({ session: { accessToken: 'challenge-token' } });
            const { httpClient, challengeCount } = await createFakeHttpClient(
                [{ match: '/subscriptions', body: { value: [{ subscriptionId: 'sub-1', displayName: 'After Challenge', tenantId: 'tenant-1', state: 'Enabled' }] } }],
                { match: '/subscriptions', wwwAuthenticate: 'Bearer realm="", authorization_uri="https://login.microsoftonline.com/common"' },
            );

            const provider = new TestSubscriptionProvider({ vscode, credentialFactory: () => fakeTokenCredential(), httpClient });

            const subs = await provider.getSubscriptionsForTenant({ tenantId: 'tenant-1', account: testAccount() });

            assert.strictEqual(challengeCount(), 1, 'a challenge should have been issued once');
            assert.strictEqual(subs.length, 1);
            assert.strictEqual(subs[0].name, 'After Challenge');
            // The interactive challenge handler should have called getSession with a challenge request.
            const challengeCall = getSessionCalls.find(c => typeof c.scopeListOrRequest === 'object' && !Array.isArray(c.scopeListOrRequest));
            assert.ok(challengeCall, 'expected an interactive getSession for the challenge');
            assert.strictEqual(challengeCall.options?.createIfNone, true);
            provider.dispose();
        });
    });

    suite('getAvailableSubscriptions', () => {
        test('aggregates and dedupes subscriptions across tenants', async () => {
            const { vscode } = createFakeVsCode({ accounts: [testAccount()] });
            const { httpClient } = await createFakeHttpClient([
                { match: '/tenants', body: { value: [{ tenantId: 'tenant-1', displayName: 'Contoso' }] } },
                {
                    match: '/subscriptions',
                    body: {
                        value: [
                            { subscriptionId: 'sub-1', displayName: 'Beta', tenantId: 'tenant-1', state: 'Enabled' },
                            { subscriptionId: 'sub-1', displayName: 'Beta', tenantId: 'tenant-1', state: 'Enabled' }, // duplicate
                            { subscriptionId: 'sub-2', displayName: 'Alpha', tenantId: 'tenant-1', state: 'Enabled' },
                        ],
                    },
                },
            ]);

            const provider = new TestSubscriptionProvider({ vscode, credentialFactory: () => fakeTokenCredential(), httpClient });

            const subs = await provider.getAvailableSubscriptions();
            // Deduped to 2, sorted by name (Alpha before Beta).
            assert.deepStrictEqual(subs.map(s => s.name), ['Alpha', 'Beta']);
            provider.dispose();
        });
    });

    // Mirrors how a credential-first provider (e.g. the Azure DevOps provider) configures the base: an
    // injected credential factory plus a getTokenForChallenge override that refuses interactive challenges.
    suite('credential-first provider (DevOps-style)', () => {
        test('lists subscriptions end-to-end through the injected credential factory', async () => {
            const { vscode } = createFakeVsCode();
            const { httpClient } = await createFakeHttpClient([
                { match: '/subscriptions', body: { value: [{ subscriptionId: 'sub-1', displayName: 'DevOps Sub', tenantId: 'tenant-1', state: 'Enabled' }] } },
            ]);

            const provider = new DevOpsStyleProvider({ vscode, credentialFactory: () => fakeTokenCredential('devops-token'), httpClient });

            const subs = await provider.getSubscriptionsForTenant({ tenantId: 'tenant-1', account: testAccount() });

            assert.strictEqual(subs.length, 1);
            assert.strictEqual(subs[0].subscriptionId, 'sub-1');
            assert.ok(typeof subs[0].credential.getToken === 'function');
            assert.ok(!('authentication' in subs[0]));
            provider.dispose();
        });

        test('fails listing when the server issues a challenge it cannot satisfy', async () => {
            const { vscode } = createFakeVsCode();
            const { httpClient } = await createFakeHttpClient(
                [{ match: '/subscriptions', body: { value: [] } }],
                { match: '/subscriptions', wwwAuthenticate: 'Bearer realm="", authorization_uri="https://login.microsoftonline.com/common"' },
            );

            const provider = new DevOpsStyleProvider({ vscode, credentialFactory: () => fakeTokenCredential('devops-token'), httpClient });

            await assert.rejects(() => provider.getSubscriptionsForTenant({ tenantId: 'tenant-1', account: testAccount() }));
            provider.dispose();
        });
    });
});

// Subclass that exposes the protected createCredentialForTenant for testing.
class TestCredentialProvider extends AzureSubscriptionProviderBase {
    public exposeCredential(tenant: { tenantId?: string; account?: AzureAccount }): TokenCredential {
        return this.createCredentialForTenant(tenant);
    }
}

