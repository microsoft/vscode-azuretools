/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import * as vscode from 'vscode';
import type { TokenCredential } from '@azure/core-auth';
import { AzureSubscriptionProviderBase } from './AzureSubscriptionProviderBase';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureAuthentication } from '../contracts/AzureAuthentication';
import type { TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';
import { AzurePublicCloud, type EnvironmentLike } from '../next/contracts/EnvironmentLike';
import { createAzureDevOpsCredential } from '../next/testing';
import { isAuthenticationWwwAuthenticateRequest } from '../next/utils/isAuthenticationWwwAuthenticateRequest';
import { getConfiguredAzureEnv } from '../utils/configuredAzureEnv';
import { NotSignedInError } from '../utils/NotSignedInError';

export interface AzureDevOpsSubscriptionProviderInitializer {
    /**
    * The resource ID of the Azure DevOps federated service connection,
    *   which can be found on the `resourceId` field of the URL at the address bar
    *   when viewing the service connection in the Azure DevOps portal
    */
    serviceConnectionId: string,
    /**
     * The `Tenant ID` field of the service connection properties
     */
    tenantId: string,
    /**
    * The `Service Principal Id` field of the service connection properties
    */
    clientId: string;
}

let azureDevOpsSubscriptionProvider: AzureDevOpsSubscriptionProvider | undefined;
export function createAzureDevOpsSubscriptionProviderFactory(initializer: AzureDevOpsSubscriptionProviderInitializer, logger?: vscode.LogOutputChannel): () => Promise<AzureDevOpsSubscriptionProvider> {
    return (): Promise<AzureDevOpsSubscriptionProvider> => {
        azureDevOpsSubscriptionProvider ??= new AzureDevOpsSubscriptionProvider(initializer, logger);
        return Promise.resolve(azureDevOpsSubscriptionProvider);
    };
}

function ensureEndingSlash(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
}

/**
 * An {@link AzureSubscriptionProviderBase} that authenticates via a federated Azure DevOps service
 * connection, using workflow identity federation. It supplies an Azure DevOps credential as the provider's
 * credential factory and exposes a single fixed account and tenant (the service principal).
 *
 * @remarks This is exposed from the legacy `./azdo` entrypoint, so its subscriptions keep the legacy shape:
 * each exposes its {@link TokenCredential} via `credential` *and* a per-subscription {@link AzureAuthentication}
 * (whose sessions are derived from the federated credential). To learn how to configure your DevOps
 * environment to use this provider, refer to the README.md.
 *
 * NOTE: This provider is only usable when running in an Azure DevOps pipeline.
 * Reference: https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation
 */
export class AzureDevOpsSubscriptionProvider extends AzureSubscriptionProviderBase {
    private readonly devOpsCredential: TokenCredential;
    private readonly devOpsTenantId: string;

    public constructor({ serviceConnectionId, tenantId, clientId }: AzureDevOpsSubscriptionProviderInitializer, logger?: vscode.LogOutputChannel) {
        // Lazily create (and memoize) the underlying Azure DevOps credential on first token request, so
        // `@azure/identity` is only loaded when actually needed.
        let inner: Promise<TokenCredential> | undefined;
        const credential: TokenCredential = {
            getToken: (scopes, options) => {
                inner ??= createAzureDevOpsCredential({ serviceConnectionId, tenantId, clientId });
                return inner.then((c) => c.getToken(scopes, options));
            },
        };
        super(logger, () => credential);
        this.devOpsCredential = credential;
        this.devOpsTenantId = tenantId;
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, this event will never fire.
     */
    public override onRefreshSuggested = (): vscode.Disposable => { return { dispose: () => { /* empty */ } }; };

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, the environment is always the public Azure cloud.
     */
    protected override getEnvironment(): { environment: EnvironmentLike, isCustomCloud: boolean } {
        return { environment: AzurePublicCloud, isCustomCloud: false };
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, this returns a single account with a fixed ID and label.
     */
    public override getAccounts(): Promise<AzureAccount[]> {
        return Promise.resolve([
            {
                id: 'test-account-id',
                label: 'test-account',
                environment: getConfiguredAzureEnv(),
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
        // Acquire a token to ensure the federated credential is usable. Federated identity has no
        // interactive sign-in, so this just probes the credential.
        const token = await this.devOpsCredential.getToken(`${ensureEndingSlash(AzurePublicCloud.managementEndpointUrl)}.default`);
        return !!token;
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, the {@link AzureAuthentication} exposed on each
     * subscription derives its sessions from the federated DevOps credential rather than from a VS Code
     * sign-in. Challenge requests cannot be satisfied (there is no user to prompt in a pipeline), so they throw.
     */
    protected override buildAuthentication(tenant: Partial<TenantIdAndAccount>): AzureAuthentication {
        const getSessionWithScopes = async (scopeListOrRequest: string[] | vscode.AuthenticationWwwAuthenticateRequest): Promise<vscode.AuthenticationSession> => {
            if (isAuthenticationWwwAuthenticateRequest(scopeListOrRequest)) {
                throw new Error('Getting a session with a challenge is not supported in AzureDevOpsSubscriptionProvider.');
            }

            const token = await this.devOpsCredential.getToken(scopeListOrRequest);
            if (!token) {
                throw new NotSignedInError();
            }

            return {
                accessToken: token.token,
                id: crypto.randomUUID(),
                account: tenant.account ?? { id: 'test-account-id', label: 'test-account' },
                scopes: scopeListOrRequest,
            } satisfies vscode.AuthenticationSession;
        };

        return {
            getSession: () => getSessionWithScopes([`${ensureEndingSlash(AzurePublicCloud.managementEndpointUrl)}.default`]),
            getSessionWithScopes: getSessionWithScopes,
        };
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, interactive challenges cannot be satisfied (there is no
     * user to prompt in a pipeline), so this always throws.
     */
    protected override getTokenForChallenge(): Promise<string | undefined> {
        throw new Error('Getting a session with a challenge is not supported in AzureDevOpsSubscriptionProvider.');
    }
}
