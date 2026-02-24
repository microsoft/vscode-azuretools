/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionClient } from '@azure/arm-resources-subscriptions'; // Keep this as `import type` to avoid actually loading the package before necessary
import type { GetTokenOptions, TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package (at all, this one is dev-only)
import * as vscode from 'vscode';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureAuthentication } from '../contracts/AzureAuthentication';
import type { AzureSubscription } from '../contracts/AzureSubscription';
import type { AzureSubscriptionProvider, RefreshSuggestedEvent, TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import { DefaultOptions, DefaultSignInOptions, type GetAccountsOptions, type GetAvailableSubscriptionsOptions, type GetSubscriptionsForTenantOptions, type GetTenantsForAccountOptions, type SignInOptions } from '../contracts/AzureSubscriptionProviderRequestOptions';
import type { AzureTenant } from '../contracts/AzureTenant';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from '../utils/configuredAzureEnv';
import { dedupeSubscriptions } from '../utils/dedupeSubscriptions';
import { getSessionFromVSCode } from '../utils/getSessionFromVSCode';
import { getSignalForToken } from '../utils/getSignalForToken';
import { isAuthenticationWwwAuthenticateRequest } from '../utils/isAuthenticationWwwAuthenticateRequest';
import { Limiter } from '../utils/Limiter';
import { isNotSignedInError, NotSignedInError } from '../utils/NotSignedInError';
import { screen } from '../utils/screen';
import { tryGetTokenExpiration } from '../utils/tryGetTokenExpiration';

const EventDebounce = 5 * 1000; // 5 seconds minimum between `onRefreshSuggested` events
const EventSilenceTime = 5 * 1000; // 5 seconds after sign-in to silence `onRefreshSuggested` events

const TenantListConcurrency = 3; // We will try to list tenants for at most 3 accounts in parallel
const SubscriptionListConcurrency = 5; // We will try to list subscriptions for at most 5 account+tenants in parallel

let armSubs: typeof import('@azure/arm-resources-subscriptions') | undefined;

/**
 * Base class for Azure subscription providers that use VS Code authentication.
 * Handles actual communication with Azure via the Azure SDK, as well as
 * controlling the firing of `onRefreshSuggested` events.
 */
export abstract class AzureSubscriptionProviderBase implements AzureSubscriptionProvider, vscode.Disposable {
    private sessionChangeListener: vscode.Disposable | undefined;
    private readonly refreshSuggestedEmitter = new vscode.EventEmitter<RefreshSuggestedEvent>();
    private lastRefreshSuggestedTime: number = 0;
    private suppressRefreshSuggestedEvents: boolean = false;

    /**
     * Constructs a new {@link AzureSubscriptionProviderBase}.
     * @param logger (Optional) A logger to record information to
     */
    public constructor(private readonly logger?: vscode.LogOutputChannel) { }

    public dispose(): void {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }
        this.sessionChangeListener?.dispose();
        this.refreshSuggestedEmitter.dispose();
    }

    /**
     * @inheritdoc
     */
    public onRefreshSuggested(callback: (evtArgs: RefreshSuggestedEvent) => unknown, thisArg?: unknown, disposables?: vscode.Disposable[]): vscode.Disposable {
        this.sessionChangeListener ??= vscode.authentication.onDidChangeSessions(evt => {
            if (evt.provider.id === getConfiguredAuthProviderId()) {
                this.fireRefreshSuggestedIfNeeded({ reason: 'sessionChange' });
            }
        });

        return this.refreshSuggestedEmitter.event(callback, thisArg, disposables);
    }

    protected fireRefreshSuggestedIfNeeded(evtArgs: RefreshSuggestedEvent): boolean {
        if (this.suppressRefreshSuggestedEvents || Date.now() < this.lastRefreshSuggestedTime + EventDebounce) {
            // Suppress and/or debounce events to avoid flooding
            return false;
        }

        this.log(`Firing onRefreshSuggested event due to reason: ${evtArgs.reason}`);
        this.lastRefreshSuggestedTime = Date.now();
        this.refreshSuggestedEmitter.fire(evtArgs);
        return true;
    }

    /**
     * @inheritdoc
     */
    public async signIn(tenant?: Partial<TenantIdAndAccount>, options: SignInOptions = DefaultSignInOptions): Promise<boolean> {
        const prompt = options.promptIfNeeded ?? DefaultSignInOptions.promptIfNeeded;

        if (prompt) {
            // If interactive, suppress without timeout until sign in is done (it can take a while when done interactively)
            this.suppressRefreshSuggestedEvents = true;
        } else {
            // If silent, suppress with normal timeout
            this.silenceRefreshEvents();
        }

        const session = await getSessionFromVSCode(
            undefined,
            tenant?.tenantId,
            {
                account: tenant?.account,
                clearSessionPreference: options.clearSessionPreference ?? DefaultSignInOptions.clearSessionPreference,
                createIfNone: prompt,
                silent: !prompt,
            }
        );

        if (prompt) {
            // Interactive sign in can take a while, so silence events for a bit longer
            this.silenceRefreshEvents();
        }

        return !!session;
    }

    /**
     * @inheritdoc
     */
    public async getAvailableSubscriptions(options: GetAvailableSubscriptionsOptions = DefaultOptions): Promise<AzureSubscription[]> {
        try {
            const availableSubscriptions: AzureSubscription[] = [];

            const tenantListLimiter = new Limiter<void>(TenantListConcurrency);
            const tenantListPromises: Promise<void>[] = [];

            const subscriptionListLimiter = new Limiter<void>(SubscriptionListConcurrency);
            const subscriptionListPromisesFlat: Promise<void>[] = [];

            let tenantsProcessed = 0;
            const maximumTenants = options.maximumTenants ?? DefaultOptions.maximumTenants;

            const accounts = await this.getAccounts(options);

            for (const account of accounts) {
                this.throwIfCancelled(options.token);
                tenantListPromises.push(tenantListLimiter.queue(async () => {
                    try {
                        if (tenantsProcessed >= maximumTenants) {
                            this.logForAccount(account, `Skipping account because maximum tenants of ${maximumTenants} has been reached`);
                            return;
                        }

                        const tenants = await this.getTenantsForAccount(account, options);

                        for (const tenant of tenants) {
                            this.throwIfCancelled(options.token);

                            if (tenantsProcessed >= maximumTenants) {
                                this.logForAccount(account, `Skipping remaining tenants because maximum tenants of ${maximumTenants} has been reached`);
                                break;
                            }
                            tenantsProcessed++;

                            subscriptionListPromisesFlat.push(subscriptionListLimiter.queue(async () => {
                                try {
                                    const subscriptions = await this.getSubscriptionsForTenant(tenant, options);
                                    availableSubscriptions.push(...subscriptions);
                                } catch (err) {
                                    if (isNotSignedInError(err)) {
                                        this.logForTenant(tenant, 'Skipping account+tenant because it is not signed in');
                                        return;
                                    }
                                    throw err;
                                }
                            }));
                        }
                    } catch (err) {
                        if (isNotSignedInError(err)) {
                            this.logForAccount(account, 'Skipping account because it is not signed in');
                            return;
                        }
                    }
                }));
            }

            await Promise.all(tenantListPromises);
            await Promise.all(subscriptionListPromisesFlat);

            return dedupeSubscriptions(availableSubscriptions);
        } catch (err) {
            // Intentionally not eating NotSignedInError here, if it is thrown by getAccounts()
            this.remapLogRethrow(err, options.token);
        } finally {
            this.throwIfCancelled(options.token);
        }
    }

    /**
     * @inheritdoc
     */
    public async getAccounts(options: GetAccountsOptions = DefaultOptions): Promise<AzureAccount[]> {
        try {
            const startTime = Date.now();
            this.log('Fetching accounts...');
            this.silenceRefreshEvents();

            const environment = getConfiguredAzureEnv();

            const results = (await vscode.authentication.getAccounts(getConfiguredAuthProviderId())).map(account => {
                return {
                    ...account,
                    environment,
                };
            });

            if (results.length === 0) {
                this.log('No accounts found');
                throw new NotSignedInError();
            }

            this.log(`Fetched ${results.length} accounts (before filter) in ${Date.now() - startTime}ms`);
            return Array.from(results);
        } catch (err) {
            // Cancellation is not actually supported by vscode.authentication.getAccounts, but just in case it is added in the future...
            this.remapLogRethrow(err, options.token);
        } finally {
            this.throwIfCancelled(options.token);
        }
    }

    /**
     * @inheritdoc
     */
    public async getUnauthenticatedTenantsForAccount(account: AzureAccount, options: Omit<GetTenantsForAccountOptions, 'filter'> = DefaultOptions): Promise<AzureTenant[]> {
        try {
            const startTime = Date.now();

            const tenantListLimiter = new Limiter<void>(TenantListConcurrency);
            const tenantListPromises: Promise<void>[] = [];

            const allTenants = await this.getTenantsForAccount(account, { ...options, filter: false });

            const unauthenticatedTenants: AzureTenant[] = [];
            for (const tenant of allTenants) {
                tenantListPromises.push(tenantListLimiter.queue(async () => {
                    this.throwIfCancelled(options.token);
                    this.silenceRefreshEvents();
                    const session = await getSessionFromVSCode(
                        undefined,
                        tenant.tenantId,
                        {
                            account: account,
                            createIfNone: false,
                            silent: true,
                        }
                    );

                    if (!session) {
                        unauthenticatedTenants.push(tenant);
                    }
                }));
            }

            await Promise.all(tenantListPromises);

            this.logForAccount(account, `Found ${unauthenticatedTenants.length} unauthenticated tenants in ${Date.now() - startTime}ms`);

            return unauthenticatedTenants;
        } finally {
            this.throwIfCancelled(options.token);
        }
    }

    /**
     * @inheritdoc
     */
    public async getTenantsForAccount(account: AzureAccount, options: GetTenantsForAccountOptions = DefaultOptions): Promise<AzureTenant[]> {
        try {
            const startTime = Date.now();
            this.logForAccount(account, 'Fetching tenants for account...');

            const { client } = await this.getSubscriptionClient({ account: account, tenantId: undefined });

            const allTenants: AzureTenant[] = [];

            for await (const tenant of client.tenants.list({ abortSignal: getSignalForToken(options.token) })) {
                allTenants.push({
                    ...tenant,
                    tenantId: tenant.tenantId!, // eslint-disable-line @typescript-eslint/no-non-null-assertion -- This is never null in practice
                    account: account,
                });
            }

            this.logForAccount(account, `Fetched ${allTenants.length} tenants (before filter) in ${Date.now() - startTime}ms`);
            return allTenants;
        } catch (err) {
            this.remapLogRethrow(err, options.token);
        } finally {
            this.throwIfCancelled(options.token);
        }
    }

    /**
     * @inheritdoc
     */
    public async getSubscriptionsForTenant(tenant: TenantIdAndAccount, options: GetSubscriptionsForTenantOptions = DefaultOptions): Promise<AzureSubscription[]> {
        try {
            const startTime = Date.now();
            this.logForTenant(tenant, 'Fetching subscriptions for account+tenant...');

            const { client, credential, authentication } = await this.getSubscriptionClient(tenant);
            const environment = getConfiguredAzureEnv();

            const allSubs: AzureSubscription[] = [];

            for await (const subscription of client.subscriptions.list({ abortSignal: getSignalForToken(options.token) })) {
                allSubs.push({
                    authentication: authentication,
                    environment: environment,
                    credential: credential,
                    isCustomCloud: environment.isCustomCloud,
                    /* eslint-disable @typescript-eslint/no-non-null-assertion */
                    name: subscription.displayName!,
                    subscriptionId: subscription.subscriptionId!,
                    /* eslint-enable @typescript-eslint/no-non-null-assertion */
                    tenantId: subscription.tenantId || tenant.tenantId, // In rare cases, a subscription may be listed but come from a different tenant
                    account: tenant.account,
                });
            }

            this.logForTenant(tenant, `Fetched ${allSubs.length} subscriptions (before filter) in ${Date.now() - startTime}ms`);
            return allSubs;
        } catch (err) {
            this.remapLogRethrow(err, options.token);
        } finally {
            this.throwIfCancelled(options.token);
        }
    }

    /**
     * Gets a {@link SubscriptionClient} plus extras for the given account+tenant.
     * @param tenant (Optional) The account+tenant to get a subscription client for. If not specified, the default account and home tenant
     * will be used.
     * @returns A {@link SubscriptionClient}, {@link TokenCredential}, and {@link AzureAuthentication} for the given account+tenant.
     */
    protected async getSubscriptionClient(tenant: Partial<TenantIdAndAccount>): Promise<{ client: SubscriptionClient, credential: TokenCredential, authentication: AzureAuthentication }> {
        const credential: TokenCredential = {
            getToken: async (scopes: string | string[], options?: GetTokenOptions) => {
                this.silenceRefreshEvents();
                const session = await getSessionFromVSCode(scopes, options?.tenantId || tenant.tenantId, { createIfNone: false, silent: true, account: tenant.account });
                if (!session) {
                    throw new NotSignedInError();
                }
                return {
                    token: session.accessToken,
                    expiresOnTimestamp: tryGetTokenExpiration(session),
                };
            }
        };

        armSubs ??= await import('@azure/arm-resources-subscriptions');

        return {
            client: new armSubs.SubscriptionClient(credential, { endpoint: getConfiguredAzureEnv().resourceManagerEndpointUrl }),
            credential: credential,
            authentication: {
                getSession: async () => {
                    this.silenceRefreshEvents();
                    const session = await getSessionFromVSCode(undefined, tenant.tenantId, { createIfNone: false, silent: true, account: tenant.account });
                    if (!session) {
                        throw new NotSignedInError();
                    }
                    return session;
                },
                getSessionWithScopes: async (scopeListOrRequest) => {
                    this.silenceRefreshEvents();
                    // in order to handle a challenge, we must enable createIfNone so
                    // that we can prompt the user to step-up their session with MFA
                    // otherwise, never prompt the user
                    const session = await getSessionFromVSCode(scopeListOrRequest, tenant.tenantId, { ...(isAuthenticationWwwAuthenticateRequest(scopeListOrRequest) ? { createIfNone: true } : { silent: true }), account: tenant.account });
                    if (!session) {
                        throw new NotSignedInError();
                    }
                    return session;
                },
            }
        };
    }

    protected log(message: string): void {
        this.logger?.debug(`[auth] ${message}`);
    }

    protected logForAccount(account: AzureAccount, message: string): void {
        this.logger?.debug(`[auth] [account: ${screen(account)}] ${message}`);
    }

    protected logForTenant(tenant: TenantIdAndAccount, message: string): void {
        this.logger?.debug(`[auth] [account: ${screen(tenant.account)}] [tenant: ${screen(tenant)}] ${message}`);
    }

    protected throwIfCancelled(token: vscode.CancellationToken | undefined): void {
        if (token?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
    }

    private timeout: NodeJS.Timeout | undefined;
    private silenceRefreshEvents(): void {
        this.suppressRefreshSuggestedEvents = true;

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }

        this.timeout = setTimeout(() => {
            clearTimeout(this.timeout);
            this.timeout = undefined;
            this.suppressRefreshSuggestedEvents = false;
        }, EventSilenceTime);
    }

    private remapLogRethrow(err: unknown, token: vscode.CancellationToken | undefined): never {
        this.throwIfCancelled(token);
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        this.logger?.error(`[auth] Error occurred: ${err}`);
        throw err;
    }
}
