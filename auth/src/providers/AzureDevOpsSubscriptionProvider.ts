/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type SubscriptionContext } from '@azure/arm-resources-subscriptions/api';
import type { TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package
import * as azureEnv from '@azure/ms-rest-azure-env'; // This package is so small that it's not worth lazy loading
import * as crypto from 'crypto';
import type * as vscode from 'vscode';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureAuthentication } from '../contracts/AzureAuthentication';
import type { TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';
import { AzureDevOpsCredential } from '../next/testing';
import { createChallengeSubscriptionClient } from '../next/createChallengeSubscriptionClient';
import { ExtendedEnvironment } from '../utils/configuredAzureEnv';
import { isAuthenticationWwwAuthenticateRequest } from '../utils/isAuthenticationWwwAuthenticateRequest';
import { NotSignedInError } from '../utils/NotSignedInError';
import { AzureSubscriptionProviderBase } from './AzureSubscriptionProviderBase';

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
export function createAzureDevOpsSubscriptionProviderFactory(initializer: AzureDevOpsSubscriptionProviderInitializer): () => Promise<AzureDevOpsSubscriptionProvider> {
    return (): Promise<AzureDevOpsSubscriptionProvider> => {
        azureDevOpsSubscriptionProvider ??= new AzureDevOpsSubscriptionProvider(initializer);
        return Promise.resolve(azureDevOpsSubscriptionProvider);
    };
}

function ensureEndingSlash(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
}

/**
 * AzureSubscriptionProvider implemented to authenticate via federated DevOps service connection, using workflow identity federation
 * To learn how to configure your DevOps environment to use this provider, refer to the README.md
 * NOTE: This provider is only available when running in an Azure DevOps pipeline
 * Reference: https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation
 */
export class AzureDevOpsSubscriptionProvider extends AzureSubscriptionProviderBase {
    private readonly devOpsCredential: AzureDevOpsCredential;
    private readonly devOpsTenantId: string;
    private signedIn: boolean = false;

    public constructor({ serviceConnectionId, tenantId, clientId }: AzureDevOpsSubscriptionProviderInitializer, logger?: vscode.LogOutputChannel) {
        super(logger);

        // `AzureDevOpsCredential` validates that the initializer values are present.
        this.devOpsCredential = new AzureDevOpsCredential({ serviceConnectionId, tenantId, clientId });
        this.devOpsTenantId = tenantId;
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, this event will never fire
     */
    public override onRefreshSuggested = (): vscode.Disposable => { return { dispose: () => { /* empty */ } }; };

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, this returns a single account with a fixed ID and label
     */
    public override getAccounts(): Promise<AzureAccount[]> {
        return Promise.resolve([
            {
                id: 'test-account-id',
                label: 'test-account',
                environment: new ExtendedEnvironment(azureEnv.Environment.AzureCloud, false),
            }
        ]);
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, this returns an empty array
     */
    public override getUnauthenticatedTenantsForAccount(): Promise<AzureTenant[]> {
        // For DevOps federated service connection, there is only one tenant associated with the service principal, and we will be authenticated
        return Promise.resolve([]);
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, this returns a single tenant associated with the service principal
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
        const token = await this.devOpsCredential.getToken(`${ensureEndingSlash(azureEnv.Environment.AzureCloud.managementEndpointUrl)}.default`);
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

        const managementScope = `${ensureEndingSlash(azureEnv.Environment.AzureCloud.managementEndpointUrl)}.default`;
        const endpoint = ensureEndingSlash(azureEnv.Environment.AzureCloud.resourceManagerEndpointUrl);

        const context = await createChallengeSubscriptionClient({
            credential: this.devOpsCredential,
            endpoint,
            scopes: [managementScope],
            logger: this.logger,
            getTokenForChallenge: () => {
                throw new Error('Getting a session with a challenge is not supported in AzureDevOpsSubscriptionProvider.');
            },
        });

        return { context, credential: this.devOpsCredential };
    }

    /**
     * @inheritdoc
     */
    protected override buildAuthentication(tenant: Partial<TenantIdAndAccount>): AzureAuthentication {
        const getSessionWithScopes = async (scopes: string[] | vscode.AuthenticationWwwAuthenticateRequest) => {
            if (!this.signedIn) {
                throw new NotSignedInError();
            }

            if (isAuthenticationWwwAuthenticateRequest(scopes)) {
                throw new Error('Getting session with challenge is not supported in AzureDevOpsSubscriptionProvider.');
            }

            const token = await this.devOpsCredential.getToken(scopes);

            if (!token) {
                throw new NotSignedInError();
            }

            return {
                accessToken: token.token,
                id: crypto.randomUUID(),
                account: tenant.account!, // eslint-disable-line @typescript-eslint/no-non-null-assertion -- The account is always provided when listing subscriptions
                scopes: scopes,
            } satisfies vscode.AuthenticationSession;
        };

        return {
            getSession: () => {
                return getSessionWithScopes([azureEnv.Environment.AzureCloud.managementEndpointUrl + '/.default']);
            },
            getSessionWithScopes: getSessionWithScopes,
        };
    }
}
