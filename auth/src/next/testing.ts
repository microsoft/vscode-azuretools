/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/core-auth';
import { type SubscriptionContext } from '@azure/arm-resources-subscriptions/api';
import type * as vscode from 'vscode';
import { AzureSubscriptionProviderBase, type AzureSubscriptionProviderOptions } from './AzureSubscriptionProviderBase';
import type { AzureAccount } from './contracts/AzureAccount';
import type { TenantIdAndAccount } from './contracts/AzureSubscriptionProvider';
import type { AzureTenant } from './contracts/AzureTenant';
import { AzurePublicCloud } from './contracts/EnvironmentLike';
import { createChallengeSubscriptionClient } from './createChallengeSubscriptionClient';
import { NotSignedInError } from './utils/NotSignedInError';

/**
 * The resolved initializer values for an {@link AzureDevOpsCredential}.
 */
export interface ResolvedAzureDevOpsCredentialInit {
    readonly serviceConnectionId: string;
    readonly tenantId: string;
    readonly clientId: string;
    readonly systemAccessToken: string;
}

/**
 * Options for constructing an {@link AzureDevOpsCredential}.
 */
export interface AzureDevOpsCredentialOptions {
    /**
     * The resource ID of the Azure DevOps federated service connection, which can be found on the
     * `resourceId` field of the URL at the address bar when viewing the service connection in the Azure
     * DevOps portal.
     */
    readonly serviceConnectionId: string;

    /**
     * The `Tenant ID` field of the service connection properties.
     */
    readonly tenantId: string;

    /**
     * The `Service Principal Id` field of the service connection properties.
     */
    readonly clientId: string;

    /**
     * (Optional) The system access token used to authenticate to Azure DevOps. Defaults to
     * `process.env.SYSTEM_ACCESSTOKEN`.
     */
    readonly systemAccessToken?: string;

    /**
     * (Optional) If true, the credential may be created outside of an Azure DevOps pipeline (i.e. when
     * `process.env.AGENT_BUILDDIRECTORY` is not set). Defaults to false.
     */
    readonly allowOutsidePipeline?: boolean;

    /**
     * (Optional, primarily for testing) Overrides the factory used to create the underlying
     * {@link TokenCredential}. When provided, `@azure/identity` is not loaded and the pipeline environment
     * checks are skipped.
     */
    readonly credentialFactory?: (init: ResolvedAzureDevOpsCredentialInit) => TokenCredential | Promise<TokenCredential>;
}

let azIdentity: typeof import('@azure/identity') | undefined;

/**
 * A {@link TokenCredential} that authenticates to Azure via an Azure DevOps federated service connection,
 * using workflow identity federation. The underlying `@azure/identity` `AzurePipelinesCredential` is lazily
 * loaded on first use, so importing this credential does not eagerly bundle `@azure/identity`.
 *
 * NOTE: This credential is only usable when running in an Azure DevOps pipeline (unless
 * {@link AzureDevOpsCredentialOptions.allowOutsidePipeline} or a custom
 * {@link AzureDevOpsCredentialOptions.credentialFactory} is provided).
 *
 * @see https://learn.microsoft.com/entra/workload-id/workload-identity-federation
 */
export class AzureDevOpsCredential implements TokenCredential {
    private inner: TokenCredential | undefined;

    public constructor(private readonly options: AzureDevOpsCredentialOptions) {
        const { serviceConnectionId, tenantId, clientId } = options;
        if (!serviceConnectionId || !tenantId || !clientId) {
            throw new Error(`Missing initializer values to identify Azure DevOps federated service connection\n
                Values provided:\n
                serviceConnectionId: ${serviceConnectionId ? "✅" : "❌"}\n
                tenantId: ${tenantId ? "✅" : "❌"}\n
                clientId: ${clientId ? "✅" : "❌"}\n
            `);
        }
    }

    /**
     * @inheritdoc
     */
    public async getToken(scopes: string | string[], options?: GetTokenOptions): Promise<AccessToken | null> {
        this.inner ??= await this.createInner();
        return this.inner.getToken(scopes, options);
    }

    private async createInner(): Promise<TokenCredential> {
        const systemAccessToken = this.options.systemAccessToken ?? process.env.SYSTEM_ACCESSTOKEN;

        if (this.options.credentialFactory) {
            if (!systemAccessToken) {
                throw new Error('Cannot create DevOps federated service connection credential because no system access token was provided (set the SYSTEM_ACCESSTOKEN environment variable or pass `systemAccessToken`).');
            }
            return await this.options.credentialFactory({
                serviceConnectionId: this.options.serviceConnectionId,
                tenantId: this.options.tenantId,
                clientId: this.options.clientId,
                systemAccessToken,
            });
        }

        if (!this.options.allowOutsidePipeline && !process.env.AGENT_BUILDDIRECTORY) {
            // Assume that AGENT_BUILDDIRECTORY is set if running in an Azure DevOps pipeline.
            throw new Error('Cannot create DevOps federated service connection credential outside of an Azure DevOps pipeline.');
        } else if (!systemAccessToken) {
            throw new Error('Cannot create DevOps federated service connection credential because the SYSTEM_ACCESSTOKEN environment variable is not set.');
        }

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore @azure/identity contains a bug where this type mismatches between CJS and ESM, we must ignore it. We also can't do @ts-expect-error because the error only happens when building CJS.
        azIdentity ??= await import('@azure/identity');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion
        return new azIdentity!.AzurePipelinesCredential(this.options.tenantId, this.options.clientId, this.options.serviceConnectionId, systemAccessToken);
    }
}

function ensureEndingSlash(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
}

/**
 * Options for constructing an {@link AzureDevOpsSubscriptionProvider}.
 */
export type AzureDevOpsSubscriptionProviderOptions = AzureDevOpsCredentialOptions & Omit<AzureSubscriptionProviderOptions, 'credential'>;

/**
 * An {@link AzureSubscriptionProviderBase} that authenticates via an Azure DevOps federated service
 * connection, using an {@link AzureDevOpsCredential}. It exposes a single fixed account and tenant (the
 * service principal), and never fires `onRefreshSuggested`.
 *
 * NOTE: This provider is only usable when running in an Azure DevOps pipeline.
 */
export class AzureDevOpsSubscriptionProvider extends AzureSubscriptionProviderBase {
    private readonly devOpsCredential: AzureDevOpsCredential;
    private readonly devOpsTenantId: string;
    private readonly devOpsHttpClient: import('@azure/core-rest-pipeline').HttpClient | undefined;
    private signedIn: boolean = false;

    public constructor(options: AzureDevOpsSubscriptionProviderOptions) {
        const credential = new AzureDevOpsCredential(options);
        super({ vscode: options.vscode, logger: options.logger, httpClient: options.httpClient, credential });
        this.devOpsCredential = credential;
        this.devOpsTenantId = options.tenantId;
        this.devOpsHttpClient = options.httpClient;
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, this event will never fire.
     */
    public override onRefreshSuggested = (): vscode.Disposable => { return { dispose: () => { /* empty */ } }; };

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, this returns a single account with a fixed ID and label.
     */
    public override getAccounts(): Promise<AzureAccount[]> {
        return Promise.resolve([
            {
                id: 'test-account-id',
                label: 'test-account',
                environment: AzurePublicCloud,
            },
        ]);
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, this returns an empty array, since the single tenant is
     * always authenticated.
     */
    public override getUnauthenticatedTenantsForAccount(): Promise<AzureTenant[]> {
        return Promise.resolve([]);
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, this returns the single tenant associated with the
     * service principal.
     */
    public override getTenantsForAccount(account: AzureAccount): Promise<AzureTenant[]> {
        return Promise.resolve([{
            tenantId: this.devOpsTenantId,
            account: account,
        }]);
    }

    /**
     * @inheritdoc
     */
    public override async signIn(): Promise<boolean> {
        // Acquire a token to ensure the federated credential is usable.
        const token = await this.devOpsCredential.getToken(`${ensureEndingSlash(AzurePublicCloud.managementEndpointUrl)}.default`);
        this.signedIn = !!token;
        return this.signedIn;
    }

    /**
     * @inheritdoc
     */
    protected override async getSubscriptionContext(_tenant: Partial<TenantIdAndAccount>): Promise<{ context: SubscriptionContext, credential: TokenCredential }> {
        if (!this.signedIn) {
            throw new NotSignedInError();
        }

        const managementScope = `${ensureEndingSlash(AzurePublicCloud.managementEndpointUrl)}.default`;
        const endpoint = ensureEndingSlash(AzurePublicCloud.resourceManagerEndpointUrl);

        const context = await createChallengeSubscriptionClient({
            credential: this.devOpsCredential,
            endpoint,
            scopes: [managementScope],
            logger: this.logger,
            httpClient: this.devOpsHttpClient,
            getTokenForChallenge: () => {
                throw new Error('Getting a session with a challenge is not supported in AzureDevOpsSubscriptionProvider.');
            },
        });

        return { context, credential: this.devOpsCredential };
    }
}
