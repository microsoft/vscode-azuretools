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
import type { TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';
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

let armSubs: typeof import('@azure/arm-resources-subscriptions') | undefined;
let azIdentity: typeof import('@azure/identity') | undefined;

/**
 * AzureSubscriptionProvider implemented to authenticate via federated DevOps service connection, using workflow identity federation
 * To learn how to configure your DevOps environment to use this provider, refer to the README.md
 * NOTE: This provider is only available when running in an Azure DevOps pipeline
 * Reference: https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation
 */
export class AzureDevOpsSubscriptionProvider extends AzureSubscriptionProviderBase {
    private _tokenCredential: TokenCredential | undefined;
    private _serviceConnectionId: string;
    private _tenantId: string;
    private _clientId: string;

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

        this._serviceConnectionId = serviceConnectionId;
        this._tenantId = tenantId;
        this._clientId = clientId;
    }

    /**
     * For {@link AzureSubscriptionProviderBase}, this event will never fire
     */
    public override onRefreshSuggested = () => { return { dispose: () => { /* empty */ } }; };

    /**
     * For {@link AzureSubscriptionProviderBase}, this returns a single account with a fixed ID and label
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
     * For {@link AzureSubscriptionProviderBase}, this returns an empty array
     */
    public override getUnauthenticatedTenantsForAccount(): Promise<AzureTenant[]> {
        // For DevOps federated service connection, there is only one tenant associated with the service principal, and we will be authenticated
        return Promise.resolve([]);
    }

    /**
     * For {@link AzureSubscriptionProviderBase}, this returns a single tenant associated with the service principal
     */
    public override getTenantsForAccount(account: AzureAccount): Promise<AzureTenant[]> {
        return Promise.resolve([{
            tenantId: this._tenantId,
            account: account,
        }]);
    }

    /**
     * @inheritdoc
     */
    public override async signIn(): Promise<boolean> {
        this._tokenCredential ??= await getTokenCredential(this._serviceConnectionId, this._tenantId, this._clientId);
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
                scopes: scopes,
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
        };
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
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore @azure/identity contains a bug where this type mismatches between CJS and ESM, we must ignore it. We also can't do @ts-expect-error because the error only happens when building CJS.
        azIdentity ??= await import('@azure/identity');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion
        return new azIdentity!.AzurePipelinesCredential(tenantId, clientId, serviceConnectionId, process.env.SYSTEM_ACCESSTOKEN);
    }
}
