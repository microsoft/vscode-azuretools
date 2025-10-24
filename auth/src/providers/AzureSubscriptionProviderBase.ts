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
import type { AzureSubscriptionProvider, GetOptions, GetSubscriptionsOptions, SignInOptions, TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from '../utils/configuredAzureEnv';
import { dedupeSubscriptions } from '../utils/dedupeSubscriptions';
import { getSessionFromVSCode } from '../utils/getSessionFromVSCode';
import { getSignalForToken } from '../utils/getSignalForToken';
import { isAuthenticationWwwAuthenticateRequest } from '../utils/isAuthenticationWwwAuthenticateRequest';
import { isNotSignedInError, NotSignedInError } from '../utils/NotSignedInError';

const EventDebounce = 5 * 1000; // 5 seconds minimum between `onRefreshSuggested` events
const EventSilenceTime = 5 * 1000; // 5 seconds after sign-in to silence `onRefreshSuggested` events

let armSubs: typeof import('@azure/arm-resources-subscriptions') | undefined;

/**
 * Base class for Azure subscription providers that use VS Code authentication.
 * Handles actual communication with Azure via the Azure SDK, as well as
 * controlling the firing of `onRefreshSuggested` events.
 */
export abstract class AzureSubscriptionProviderBase implements AzureSubscriptionProvider {
    /**
     * Constructs a new {@link AzureSubscriptionProviderBase}.
     * @param logger (Optional) A logger to record information to
     */
    public constructor(protected readonly logger?: vscode.LogOutputChannel) { }

    private lastRefreshSuggestedTime: number = 0;
    private suppressRefreshSuggestedEvents: boolean = false;

    /**
     * @inheritdoc
     */
    public onRefreshSuggested(callback: () => any, thisArg?: any, disposables?: vscode.Disposable[]): vscode.Disposable { // eslint-disable-line @typescript-eslint/no-explicit-any -- Want to match the VSCode API
        const disposable = vscode.authentication.onDidChangeSessions((evt) => {
            if (evt.provider.id !== getConfiguredAuthProviderId()) {
                // If it's not for the configured provider, ignore it
                return;
            }

            if (this.suppressRefreshSuggestedEvents || Date.now() < this.lastRefreshSuggestedTime + EventDebounce) {
                // Suppress and/or debounce events to avoid flooding
                return;
            }

            this.logger?.debug('auth: Firing onRefreshSuggested event');

            // Call the callback asynchronously to avoid potential issues
            const timeout = setTimeout(() => {
                clearTimeout(timeout);
                this.lastRefreshSuggestedTime = Date.now();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                void callback.bind(thisArg)();
            }, 0);
        });

        disposables?.push(disposable);
        return disposable;
    }

    /**
     * @inheritdoc
     */
    public async signIn(tenant?: TenantIdAndAccount, options: SignInOptions = DefaultSignInOptions): Promise<boolean> {
        const prompt = options.promptIfNeeded ?? true;

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
                clearSessionPreference: !!options.clearSessionPreference,
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
    public async getAvailableSubscriptions(options: GetOptions = DefaultGetSubscriptionsOptions): Promise<AzureSubscription[]> {
        const availableSubscriptions: AzureSubscription[] = [];

        try {
            // Due to a bug in the VSCode auth provider, we must serialize fetching tenants for accounts TODO: link that bug
            for (const account of await this.getAccounts(options)) {
                try {
                    const tenants = await this.getTenantsForAccount(account, options);

                    // Parallelize fetching subscriptions for all tenants of this account
                    const subscriptionPromises = tenants.map(async (tenant) => {
                        try {
                            const subscriptions = await this.getSubscriptionsForTenant(tenant, options);
                            availableSubscriptions.push(...subscriptions);
                        } catch (err) {
                            if (isNotSignedInError(err)) {
                                this.logger?.debug(`auth: Skipping tenant '${tenant.id}' for account '${account.id}' because it is not signed in`);
                                return;
                            }
                            throw err;
                        }
                    });

                    await Promise.all(subscriptionPromises);
                } catch (err) {
                    if (isNotSignedInError(err)) {
                        this.logger?.debug(`auth: Skipping account '${account.id}' because it is not signed in`);
                        continue;
                    }
                    throw err;
                }
            }
        } catch (err) {
            // Intentionally not catching NotSignedInError here, if it is thrown by getAccounts()
            this.remapLogRethrow(err, options.token);
        }

        return dedupeSubscriptions(availableSubscriptions);
    }

    /**
     * @inheritdoc
     */
    public async getAccounts(options: GetOptions): Promise<AzureAccount[]> {
        try {
            this.logger?.debug('auth: Fetching accounts');
            const results = await vscode.authentication.getAccounts(getConfiguredAuthProviderId());

            if (results.length === 0) {
                this.logger?.debug('auth: No accounts found');
                throw new NotSignedInError();
            }

            return Array.from(results);
        } catch (err) {
            // Cancellation is not actually supported by vscode.authentication.getAccounts, but just in case it is added in the future...
            this.remapLogRethrow(err, options.token);
        }
    }

    /**
     * @inheritdoc
     */
    public async getUnauthenticatedTenants(account: AzureAccount, options?: Omit<GetOptions, 'all'>): Promise<AzureTenant[]> {
        const allTenants = await this.getTenantsForAccount(account, { ...options, all: true });

        const unauthenticatedTenants: AzureTenant[] = [];
        for (const tenant of allTenants) {
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
        }

        return unauthenticatedTenants;
    }

    /**
     * @inheritdoc
     */
    public async getTenantsForAccount(account: AzureAccount, options: GetOptions): Promise<AzureTenant[]> {
        try {
            this.logger?.debug(`auth: Fetching tenants for account '${account.id}'`);

            const { client } = await this.getSubscriptionClient({ account: account, tenantId: undefined });

            const allTenants: AzureTenant[] = [];

            for await (const tenant of client.tenants.list({ abortSignal: getSignalForToken(options.token) })) {
                allTenants.push({
                    ...tenant,
                    tenantId: tenant.tenantId!, // eslint-disable-line @typescript-eslint/no-non-null-assertion -- This is never null in practice
                    account: account,
                });
            }

            return allTenants;
        } catch (err) {
            this.remapLogRethrow(err, options.token);
        }
    }

    /**
     * @inheritdoc
     */
    public async getSubscriptionsForTenant(tenant: TenantIdAndAccount, options: GetSubscriptionsOptions): Promise<AzureSubscription[]> {
        try {
            this.logger?.debug(`auth: Fetching subscriptions for account '${tenant.account.id}' and tenant '${tenant.tenantId}'`);

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

            return allSubs;
        } catch (err) {
            this.remapLogRethrow(err, options.token);
        }
    }

    private async getSubscriptionClient(tenant: Partial<TenantIdAndAccount>): Promise<{ client: SubscriptionClient, credential: TokenCredential, authentication: AzureAuthentication }> {
        const credential: TokenCredential = {
            getToken: async (scopes: string | string[], options?: GetTokenOptions) => {
                this.silenceRefreshEvents();
                const session = await getSessionFromVSCode(scopes, options?.tenantId || tenant.tenantId, { createIfNone: false, silent: true, account: tenant.account });
                if (!session) {
                    throw new NotSignedInError();
                }
                return {
                    token: session.accessToken,
                    expiresOnTimestamp: 0, // TODO: can we get the actual expiry? Certainly not from any encrypted tokens
                };
            }
        }

        const configuredAzureEnv = getConfiguredAzureEnv();
        const endpoint = configuredAzureEnv.resourceManagerEndpointUrl;

        armSubs ??= await import('@azure/arm-resources-subscriptions');

        return {
            client: new armSubs.SubscriptionClient(credential, { endpoint }),
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
        if (token?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        this.logger?.error(`auth: Error occurred: ${err}`);
        throw err;
    }
}

export const DefaultGetOptions: GetOptions = {
    all: false,
    noCache: false,
};

export const DefaultGetSubscriptionsOptions: GetSubscriptionsOptions = {
    ...DefaultGetOptions,
    dedupe: true,
};

const DefaultSignInOptions: SignInOptions = {
    clearSessionPreference: false,
    promptIfNeeded: true,
};
