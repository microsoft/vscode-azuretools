/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type SubscriptionContext } from '@azure/arm-resources-subscriptions/api';
import { list as listSubscriptions } from '@azure/arm-resources-subscriptions/api/subscriptions';
import { list as listTenants } from '@azure/arm-resources-subscriptions/api/tenants';
import type { TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package
import type { AzureLogger } from '@azure/logger';
import { inspect } from 'util';
import type * as vscode from 'vscode';
import { DefaultOptions, DefaultSignInOptions, type GetAccountsOptions, type GetAvailableSubscriptionsOptions, type GetSubscriptionsForTenantOptions, type GetTenantsForAccountOptions, type SignInOptions } from '../contracts/AzureSubscriptionProviderRequestOptions';
import { getSignalForToken } from '../utils/getSignalForToken';
import { Limiter } from '../utils/Limiter';
import { screen } from '../utils/screen';
import type { AzureAuthVsCode } from './contracts/AzureAuthVsCode';
import type { AzureAccount } from './contracts/AzureAccount';
import type { AzureSubscription } from './contracts/AzureSubscription';
import type { AzureSubscriptionProvider, RefreshSuggestedEvent, TenantIdAndAccount } from './contracts/AzureSubscriptionProvider';
import type { AzureTenant } from './contracts/AzureTenant';
import type { EnvironmentLike } from './contracts/EnvironmentLike';
import { createChallengeSubscriptionClient } from './createChallengeSubscriptionClient';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from './configuredEnvironment';
import { dedupeSubscriptions } from './utils/dedupeSubscriptions';
import { getSessionFromVSCode } from './utils/getSessionFromVSCode';
import { isNotSignedInError, NotSignedInError } from './utils/NotSignedInError';

const EventDebounce = 2 * 1000; // 2 seconds minimum between `onRefreshSuggested` events
const EventSilenceTime = 5 * 1000; // 5 seconds after sign-in to silence `onRefreshSuggested` events

const TenantListConcurrency = 3; // We will try to list tenants for at most 3 accounts in parallel
const SubscriptionListConcurrency = 5; // We will try to list subscriptions for at most 5 account+tenants in parallel

/**
 * A factory that produces the {@link TokenCredential} used to authenticate a given account+tenant. The
 * returned credential should honor the `tenantId` from `GetTokenOptions` (or be already bound to the
 * tenant) and may return `null` from `getToken` to signal "not signed in". The base wraps the returned
 * credential with provider policy (refresh-event suppression and {@link NotSignedInError} on a null silent
 * token), so factories only need to construct the raw credential.
 *
 * @param tenant The account+tenant the credential is for. Either field may be undefined (e.g. when listing
 * tenants for the home tenant).
 */
export type CredentialFactory = (tenant: Partial<TenantIdAndAccount>) => TokenCredential;

/**
 * Options for constructing an {@link AzureSubscriptionProviderBase}.
 */
export interface AzureSubscriptionProviderOptions {
    /**
     * (Required) The injected VS Code namespace (or a narrowed shim). Pass the whole `vscode` namespace
     * import; it is used both for the authentication namespace and for the configuration lookup.
     */
    readonly vscode: AzureAuthVsCode;

    /**
     * (Optional) A factory that creates the {@link TokenCredential} for a given account+tenant. Concrete
     * providers (e.g. the VS Code provider, or an Azure DevOps provider) supply this to control how tokens
     * are acquired. If omitted, {@link createCredentialForTenant} must be overridden, otherwise it throws.
     */
    readonly credentialFactory?: CredentialFactory;

    /**
     * (Optional) An `@azure/logger` logger to record diagnostic information to. Callers who want to route
     * this to a VS Code output channel can configure the logger accordingly.
     */
    readonly logger?: AzureLogger;

    /**
     * (Optional, primarily for testing) An HTTP client override passed through to the ARM subscriptions
     * client, so the network layer can be faked in unit tests.
     */
    readonly httpClient?: import('@azure/core-rest-pipeline').HttpClient;
}

function ensureEndingSlash(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
}

/**
 * Base class for the next-generation Azure subscription providers that use VS Code authentication, with
 * the VS Code namespace injected for dependency injection and testability. Handles actual communication
 * with Azure via the Azure SDK, as well as controlling the firing of `onRefreshSuggested` events.
 *
 * @remarks Unlike the legacy `AzureSubscriptionProviderBase`, the produced {@link AzureSubscription}s do
 * not expose an `authentication` member; all authentication is performed through their {@link TokenCredential}.
 */
export abstract class AzureSubscriptionProviderBase implements AzureSubscriptionProvider, vscode.Disposable {
    protected readonly vscode: AzureAuthVsCode;
    protected readonly logger: AzureLogger | undefined;
    private readonly credentialFactory: CredentialFactory | undefined;
    private readonly httpClient: import('@azure/core-rest-pipeline').HttpClient | undefined;

    private sessionChangeListener: vscode.Disposable | undefined;
    private readonly refreshSuggestedEmitter: vscode.EventEmitter<RefreshSuggestedEvent>;
    private lastRefreshSuggestedTime: number = 0;
    private suppressRefreshSuggestedEvents: boolean = false;

    /**
     * Constructs a new {@link AzureSubscriptionProviderBase}.
     * @param options The {@link AzureSubscriptionProviderOptions}, including the injected `vscode` namespace.
     */
    public constructor(options: AzureSubscriptionProviderOptions) {
        this.vscode = options.vscode;
        this.credentialFactory = options.credentialFactory;
        this.logger = options.logger;
        this.httpClient = options.httpClient;
        this.refreshSuggestedEmitter = new this.vscode.EventEmitter<RefreshSuggestedEvent>();
    }

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
        this.sessionChangeListener ??= this.vscode.authentication.onDidChangeSessions(evt => {
            if (evt.provider.id === this.getAuthProviderId()) {
                this.fireRefreshSuggestedIfNeeded({ reason: 'sessionChange' });
            }
        });

        return this.refreshSuggestedEmitter.event(callback, thisArg, disposables);
    }

    protected fireRefreshSuggestedIfNeeded(evtArgs: RefreshSuggestedEvent): boolean {
        // subscriptionFilterChange is an explicit user action and must never be suppressed,
        // otherwise re-selecting a subscription shortly after unselecting one gets swallowed
        // by the debounce/silence window that the first refresh triggered.
        if (evtArgs.reason !== 'subscriptionFilterChange' &&
            (this.suppressRefreshSuggestedEvents || Date.now() < this.lastRefreshSuggestedTime + EventDebounce)) {
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

        let session: vscode.AuthenticationSession | undefined;
        try {
            session = await this.getSession(
                undefined,
                tenant?.tenantId,
                {
                    account: tenant?.account,
                    clearSessionPreference: options.clearSessionPreference ?? DefaultSignInOptions.clearSessionPreference,
                    createIfNone: prompt,
                    silent: !prompt,
                }
            );
        } catch (err) {
            throw this.maybeImproveSignInError(err, tenant?.tenantId);
        }

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
                                    // Don't rethrow--skip tenants that fail for other reasons
                                    // (e.g., locked account) so remaining tenants can still be listed
                                    this.errorForTenant(tenant, 'Skipping account+tenant due to error', err);
                                }
                            }));
                        }
                    } catch (err) {
                        if (isNotSignedInError(err)) {
                            this.logForAccount(account, 'Skipping account because it is not signed in');
                            return;
                        }
                        // Log and skip accounts that fail for other reasons (e.g., locked account)
                        this.errorForAccount(account, 'Skipping account due to error', err);
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

            const { environment } = this.getEnvironment();

            const results = (await this.vscode.authentication.getAccounts(this.getAuthProviderId())).map(account => {
                return {
                    ...account,
                    environment,
                };
            });

            if (results.length === 0) {
                this.log('No accounts found');
                throw new NotSignedInError(this.notSignedInMessage());
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
                    const session = await this.getSession(
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

            const { context } = this.getSubscriptionContext({ account: account, tenantId: undefined });

            const allTenants: AzureTenant[] = [];

            for await (const tenant of listTenants(context, { abortSignal: getSignalForToken(options.token) })) {
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

            const { context, credential } = this.getSubscriptionContext(tenant);
            const { environment, isCustomCloud } = this.getEnvironment();

            const allSubs: AzureSubscription[] = [];

            for await (const subscription of listSubscriptions(context, { abortSignal: getSignalForToken(options.token) })) {
                allSubs.push({
                    environment: environment,
                    credential: credential,
                    isCustomCloud: isCustomCloud,
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
     * Gets a {@link SubscriptionContext} plus the {@link TokenCredential} for the given account+tenant.
     * @param tenant (Optional) The account+tenant to get a subscription context for. If not specified, the
     * default account and home tenant will be used.
     * @returns A {@link SubscriptionContext} and {@link TokenCredential} for the given account+tenant.
     */
    protected getSubscriptionContext(tenant: Partial<TenantIdAndAccount>): { context: SubscriptionContext, credential: TokenCredential } {
        const { environment } = this.getEnvironment();

        const credential = this.createCredentialForTenant(tenant);

        const managementScope = `${ensureEndingSlash(environment.managementEndpointUrl)}.default`;
        const endpoint = ensureEndingSlash(environment.resourceManagerEndpointUrl);
        // For challenge fallback scopes, mirror the legacy `BearerChallengePolicy`, which derived the
        // fallback scope from the resource manager endpoint (used only if VS Code cannot parse scopes from
        // the WWW-Authenticate header itself).
        const challengeFallbackScope = `${endpoint.replace(/\/+$/, '')}/.default`;

        const context = createChallengeSubscriptionClient({
            credential,
            endpoint,
            scopes: [managementScope],
            logger: this.logger,
            httpClient: this.httpClient,
            getTokenForChallenge: (wwwAuthenticate) => this.getTokenForChallenge(wwwAuthenticate, [challengeFallbackScope], tenant),
        });

        return { context, credential };
    }

    /**
     * Acquires a token to satisfy a `WWW-Authenticate` challenge (e.g. an MFA step-up) surfaced by ARM. The
     * default implementation forwards the raw challenge to VS Code's auth API via an interactive
     * `getSession` so the user can satisfy it. Subclasses whose auth source cannot satisfy interactive
     * challenges (e.g. an Azure DevOps federated identity in a pipeline) may override this to throw.
     *
     * @param wwwAuthenticate The raw `WWW-Authenticate` header value from the challenge.
     * @param fallbackScopes Scopes to use if VS Code cannot parse scopes from the header itself.
     * @param tenant The account+tenant the challenge is for.
     * @returns The access token that satisfies the challenge, or `undefined` if none could be acquired.
     */
    protected async getTokenForChallenge(wwwAuthenticate: string, fallbackScopes: string[], tenant: Partial<TenantIdAndAccount>): Promise<string | undefined> {
        // A challenge (e.g. an MFA step-up) must always be able to prompt so the user can satisfy it. This
        // forwards the raw WWW-Authenticate header to VS Code's auth API via an interactive getSession.
        this.suppressRefreshSuggestedEvents = true;
        const session = await this.getSession(
            { wwwAuthenticate, fallbackScopes },
            tenant.tenantId,
            { createIfNone: true, account: tenant.account },
        );
        this.silenceRefreshEvents();
        return session?.accessToken;
    }

    /**
     * Creates the {@link TokenCredential} to use for the given account+tenant by invoking the configured
     * {@link CredentialFactory} and wrapping the result with provider policy: refresh events are silenced
     * around token acquisition, and an unavailable silent session throws a {@link NotSignedInError}
     * (preserving listing semantics). Subclasses that don't supply a factory must override this method.
     */
    protected createCredentialForTenant(tenant: Partial<TenantIdAndAccount>): TokenCredential {
        if (!this.credentialFactory) {
            throw new Error('No credentialFactory was provided. Pass one in the constructor options or override createCredentialForTenant().');
        }

        const inner = this.credentialFactory(tenant);

        return {
            getToken: async (scopes, tokenOptions) => {
                if (tokenOptions?.claims) {
                    // CAE/MFA challenge: the inner credential performs an interactive prompt. Suppress
                    // refresh events without timeout until it's done (the prompt can take a while), then
                    // silence for a bit longer afterwards. Do NOT convert a null result (e.g. the user
                    // cancelled the prompt) into a NotSignedInError--let the bearer policy handle it.
                    this.suppressRefreshSuggestedEvents = true;
                    try {
                        return await inner.getToken(scopes, tokenOptions);
                    } finally {
                        this.silenceRefreshEvents();
                    }
                }

                this.silenceRefreshEvents();
                const token = await inner.getToken(scopes, tokenOptions);
                if (!token) {
                    throw new NotSignedInError(this.notSignedInMessage());
                }
                return token;
            },
        };
    }

    /**
     * Acquires a VS Code authentication session using the injected authentication namespace, the configured
     * auth provider, and the configured environment's default scope resource.
     */
    protected getSession(scopeOrListOrRequest?: string | string[] | vscode.AuthenticationWwwAuthenticateRequest, tenantId?: string, options?: vscode.AuthenticationGetSessionOptions): Promise<vscode.AuthenticationSession | undefined> {
        return getSessionFromVSCode(
            {
                authentication: this.vscode.authentication,
                authProviderId: this.getAuthProviderId(),
                defaultScopeResource: this.getEnvironment().environment.managementEndpointUrl,
            },
            scopeOrListOrRequest,
            tenantId,
            options,
        );
    }

    /**
     * Gets the configured auth provider id (e.g. `'microsoft'`).
     */
    protected getAuthProviderId(): string {
        return getConfiguredAuthProviderId(this.vscode);
    }

    /**
     * Gets the configured cloud environment and whether it is a custom cloud.
     */
    protected getEnvironment(): { environment: EnvironmentLike, isCustomCloud: boolean } {
        return getConfiguredAzureEnv(this.vscode);
    }

    protected log(message: string): void {
        this.logger?.info(`[auth] ${message}`);
    }

    protected logForAccount(account: AzureAccount, message: string): void {
        this.logger?.info(`[auth] [account: ${screen(account)}] ${message}`);
    }

    protected logForTenant(tenant: TenantIdAndAccount, message: string): void {
        this.logger?.info(`[auth] [account: ${screen(tenant.account)}] [tenant: ${screen(tenant)}] ${message}`);
    }

    protected warnForAccount(account: AzureAccount, message: string): void {
        this.logger?.warning(`[auth] [account: ${screen(account)}] ${message}`);
    }

    protected warnForTenant(tenant: TenantIdAndAccount, message: string): void {
        this.logger?.warning(`[auth] [account: ${screen(tenant.account)}] [tenant: ${screen(tenant)}] ${message}`);
    }

    protected errorForAccount(account: AzureAccount, message: string, err: unknown): void {
        this.logger?.error(`[auth] [account: ${screen(account)}] ${message}`);
        this.logger?.error(`[auth] [account: ${screen(account)}] ${err instanceof Error ? (err.stack ?? err.message) : inspect(err)}`);
    }

    protected errorForTenant(tenant: TenantIdAndAccount, message: string, err: unknown): void {
        this.logger?.error(`[auth] [account: ${screen(tenant.account)}] [tenant: ${screen(tenant)}] ${message}`);
        this.logger?.error(`[auth] [account: ${screen(tenant.account)}] [tenant: ${screen(tenant)}] ${err instanceof Error ? (err.stack ?? err.message) : inspect(err)}`);
    }

    protected throwIfCancelled(token: vscode.CancellationToken | undefined): void {
        if (token?.isCancellationRequested) {
            throw new this.vscode.CancellationError();
        }
    }

    private notSignedInMessage(): string {
        return this.vscode.l10n.t('You are not signed in to an Azure account. Please sign in.');
    }

    private timeout: NodeJS.Timeout | undefined;
    protected silenceRefreshEvents(): void {
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

    /**
     * Suppresses `onRefreshSuggested` events without a timeout, until the next call to
     * {@link silenceRefreshEvents}. Use this around long-running interactive operations (e.g. a consent
     * prompt) that can take a while, so events aren't fired in the middle of them.
     */
    protected beginInteractiveRefreshSuppression(): void {
        this.suppressRefreshSuggestedEvents = true;
    }

    private remapLogRethrow(err: unknown, token: vscode.CancellationToken | undefined): never {
        this.throwIfCancelled(token);
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        this.logger?.error(`[auth] Error occurred: ${err}`);
        throw err;
    }

    /**
     * Inspects an error thrown during sign-in and returns a more user-friendly error when possible (e.g.
     * native broker errors), otherwise returns the original error unchanged.
     */
    private maybeImproveSignInError(err: unknown, tenantId: string | undefined): unknown {
        if (!(err instanceof Error)) {
            return err;
        }

        const message = err.message;

        // The native MSAL broker surfaces opaque "platform_broker_error" messages
        // that don't tell the user what went wrong. Re-wrap with actionable text.
        if (message.includes('platform_broker_error')) {
            const tenantHint = tenantId
                ? this.vscode.l10n.t(' for tenant "{0}"', tenantId)
                : '';
            const improved = new Error(
                this.vscode.l10n.t(
                    'Sign-in failed{0}. The tenant may have expired or is no longer valid. Please verify the tenant is still active and try again.',
                    tenantHint,
                ),
                { cause: err },
            );
            if (err.stack && improved.stack) {
                improved.stack += `\nCaused by: ${err.stack}`;
            }
            return improved;
        }

        return err;
    }
}
