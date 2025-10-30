/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionClient } from '@azure/arm-resources-subscriptions'; // Keep this as `import type` to avoid actually loading the package before necessary
import type { TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package (at all, this one is dev-only)
import * as azureEnv from '@azure/ms-rest-azure-env'; // This package is so small that it's not worth lazy loading
import * as crypto from 'crypto';
import type * as vscode from 'vscode';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureAuthentication } from '../contracts/AzureAuthentication';
import type { GetOptions, SignInOptions, TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';
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
    return async (): Promise<AzureDevOpsSubscriptionProvider> => {
        azureDevOpsSubscriptionProvider ??= new AzureDevOpsSubscriptionProvider(initializer);
        return azureDevOpsSubscriptionProvider;
    }
}

let armSubs: typeof import('@azure/arm-resources-subscriptions') | undefined;

/**
 * AzureSubscriptionProvider implemented to authenticate via federated DevOps service connection, using workflow identity federation
 * To learn how to configure your DevOps environment to use this provider, refer to the README.md
 * NOTE: This provider is only available when running in an Azure DevOps pipeline
 * Reference: https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation
 */
export class AzureDevOpsSubscriptionProvider extends AzureSubscriptionProviderBase {
    private _tokenCredential: TokenCredential | undefined;
    private _SERVICE_CONNECTION_ID: string;
    private _TENANT_ID: string;
    private _CLIENT_ID: string;

    public constructor({ serviceConnectionId, tenantId, clientId }: AzureDevOpsSubscriptionProviderInitializer, logger?: vscode.LogOutputChannel) {
        super(logger);

        if (!serviceConnectionId || !tenantId || !clientId) {
            throw new Error(`Missing initializer values to identify Azure DevOps federated service connection\n
                Values provided:\n
                serviceConnectionId: ${serviceConnectionId ? "✅" : "❌"}\n
                tenantId: ${tenantId ? "✅" : "❌"}\n
                clientId: ${clientId ? "✅" : "❌"}\n
            `);
        }

        this._SERVICE_CONNECTION_ID = serviceConnectionId;
        this._TENANT_ID = tenantId;
        this._CLIENT_ID = clientId;
    }

    /**
     * For {@link AzureSubscriptionProviderBase}, this event will never fire
     */
    public override onRefreshSuggested = () => { return { dispose: () => { /* empty */ } }; };

    /**
     * For {@link AzureSubscriptionProviderBase}, this returns a single account with a fixed ID and label
     */
    public override async getAccounts(_options?: GetOptions): Promise<AzureAccount[]> {
        return [
            {
                id: 'test-account-id',
                label: 'test-account',
            }
        ]
    }

    /**
     * For {@link AzureSubscriptionProviderBase}, this returns an empty array
     */
    public override async getUnauthenticatedTenantsForAccount(_account: AzureAccount, _options?: GetOptions): Promise<AzureTenant[]> {
        // For DevOps federated service connection, there is only one tenant associated with the service principal, and we will be authenticated
        return [];
    }

    /**
     * For {@link AzureSubscriptionProviderBase}, this returns a single tenant associated with the service principal
     */
    public override async getTenantsForAccount(account: AzureAccount, _options?: GetOptions): Promise<AzureTenant[]> {
        return [{
            tenantId: this._TENANT_ID,
            account: account,
        }]
    }

    /**
     * @inheritdoc
     */
    public override async signIn(_tenant?: TenantIdAndAccount, _options?: SignInOptions): Promise<boolean> {
        this._tokenCredential ??= await getTokenCredential(this._SERVICE_CONNECTION_ID, this._TENANT_ID, this._CLIENT_ID);
        return !!this._tokenCredential;
    }

    /**
     * @inheritdoc
     */
    protected override async getSubscriptionClient(tenant: TenantIdAndAccount): Promise<{ client: SubscriptionClient, credential: TokenCredential, authentication: AzureAuthentication }> {
        if (!this._tokenCredential) {
            throw new NotSignedInError();
        }

        const getSessionWithScopes = async (scopes: string[] | vscode.AuthenticationWwwAuthenticateRequest) => {
            if (isAuthenticationWwwAuthenticateRequest(scopes)) {
                throw new Error('Getting session with challenge is not supported in AzureDevOpsSubscriptionProvider.');
            }

            const token = await this._tokenCredential?.getToken(scopes);

            if (!token) {
                throw new NotSignedInError();
            }

            return {
                accessToken: token.token,
                id: crypto.randomUUID(),
                account: tenant.account,
                scopes: scopes || [],
            } satisfies vscode.AuthenticationSession;
        };

        armSubs ??= await import('@azure/arm-resources-subscriptions');

        return {
            client: new armSubs.SubscriptionClient(this._tokenCredential),
            credential: this._tokenCredential,
            authentication: {
                getSession: () => {
                    return getSessionWithScopes([azureEnv.Environment.AzureCloud.managementEndpointUrl + '/.default']);
                },
                getSessionWithScopes: getSessionWithScopes,
            }
        }
    }
}

/**
* @param serviceConnectionId The resource ID of the Azure DevOps federated service connection,
*   which can be found on the `resourceId` field of the URL at the address bar when viewing the service connection in the Azure DevOps portal
* @param tenantId The `Tenant ID` field of the service connection properties
* @param clientId The `Service Principal Id` field of the service connection properties
*/
async function getTokenCredential(serviceConnectionId: string, tenantId: string, clientId: string): Promise<TokenCredential> {
    if (!process.env.AGENT_BUILDDIRECTORY) {
        // Assume that AGENT_BUILDDIRECTORY is set if running in an Azure DevOps pipeline.
        // So when not running in an Azure DevOps pipeline, throw an error since we cannot use the DevOps federated service connection credential.
        throw new Error('Cannot create DevOps federated service connection credential outside of an Azure DevOps pipeline.');
    } else if (!process.env.SYSTEM_ACCESSTOKEN) {
        throw new Error('Cannot create DevOps federated service connection credential because the SYSTEM_ACCESSTOKEN environment variable is not set.');
    } else {
        const { AzurePipelinesCredential } = await import('@azure/identity');
        return new AzurePipelinesCredential(tenantId, clientId, serviceConnectionId, process.env.SYSTEM_ACCESSTOKEN);
    }
}
