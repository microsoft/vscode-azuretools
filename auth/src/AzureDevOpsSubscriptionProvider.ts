/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SubscriptionClient, TenantIdDescription } from '@azure/arm-resources-subscriptions';
import type { TokenCredential } from '@azure/core-auth'; // Keep this as `import type` to avoid actually loading the package (at all, this one is dev-only)
import type { PipelineRequest } from '@azure/core-rest-pipeline';
import { Disposable, Event } from 'vscode';
import { AzureAuthentication } from './AzureAuthentication';
import { AzureSubscription } from './AzureSubscription';
import { AzureSubscriptionProvider } from './AzureSubscriptionProvider';
import { getConfiguredAzureEnv } from './utils/configuredAzureEnv';

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
    domain: string,
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

/**
 * AzureSubscriptionProvider implemented to authenticate via federated DevOps service connection, using workflow identity federation
 * To learn how to configure your DevOps environment to use this provider, refer to the README.md
 * NOTE: This provider is only available when running in an Azure DevOps pipeline
 * Reference: https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation
 */
export class AzureDevOpsSubscriptionProvider implements AzureSubscriptionProvider {
    private _tokenCredential: TokenCredential & { tenantId?: string } | undefined;
    /**
    * The resource ID of the Azure DevOps federated service connection,
    *   which can be found on the `resourceId` field of the URL at the address bar
    *   when viewing the service connection in the Azure DevOps portal
    */
    private _SERVICE_CONNECTION_ID: string;
    /**
    * The `Tenant ID` field of the service connection properties
    */
    private _DOMAIN: string;
    /**
    * The `Service Principal Id` field of the service connection properties
    */
    private _CLIENT_ID: string;

    public constructor({ serviceConnectionId, domain, clientId }: AzureDevOpsSubscriptionProviderInitializer) {
        if (!serviceConnectionId || !domain || !clientId) {
            throw new Error(`Missing initializer values to identify Azure DevOps federated service connection\n
                Values provided:\n
                serviceConnectionId: ${serviceConnectionId ? "✅" : "❌"}\n
                domain: ${domain ? "✅" : "❌"}\n
                clientId: ${clientId ? "✅" : "❌"}\n
            `);
        }

        this._SERVICE_CONNECTION_ID = serviceConnectionId;
        this._DOMAIN = domain;
        this._CLIENT_ID = clientId;
    }

    async getSubscriptions(_filter: boolean): Promise<AzureSubscription[]> {
        // ignore the filter setting because not every consumer of this provider will use the Resources extension
        const results: AzureSubscription[] = [];
        for (const tenant of await this.getTenants()) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const tenantId = tenant.tenantId!;
            results.push(...await this.getSubscriptionsForTenant(tenantId));
        }
        const sortSubscriptions = (subscriptions: AzureSubscription[]): AzureSubscription[] =>
            subscriptions.sort((a, b) => a.name.localeCompare(b.name));

        return sortSubscriptions(results);
    }

    public async isSignedIn(): Promise<boolean> {
        return !!this._tokenCredential;
    }

    public async signIn(): Promise<boolean> {
        this._tokenCredential = await getTokenCredential(this._SERVICE_CONNECTION_ID, this._DOMAIN, this._CLIENT_ID);
        return !!this._tokenCredential;
    }

    public async signOut(): Promise<void> {
        this._tokenCredential = undefined;
    }

    public async getTenants(): Promise<TenantIdDescription[]> {
        return [{
            tenantId: this._tokenCredential?.tenantId,
        }];
    }

    /**
     * Gets the subscriptions for a given tenant.
     *
     * @param tenantId The tenant ID to get subscriptions for.
     *
     * @returns The list of subscriptions for the tenant.
     */
    private async getSubscriptionsForTenant(tenantId: string): Promise<AzureSubscription[]> {
        const { client, credential, authentication } = await this.getSubscriptionClient(tenantId);
        const environment = getConfiguredAzureEnv();

        const subscriptions: AzureSubscription[] = [];

        for await (const subscription of client.subscriptions.list()) {
            subscriptions.push({
                authentication,
                environment: environment,
                credential: credential,
                isCustomCloud: environment.isCustomCloud,
                /* eslint-disable @typescript-eslint/no-non-null-assertion */
                name: subscription.displayName!,
                subscriptionId: subscription.subscriptionId!,
                /* eslint-enable @typescript-eslint/no-non-null-assertion */
                tenantId,
            });
        }

        return subscriptions;
    }

    /**
     * Gets a fully-configured subscription client for a given tenant ID
     *
     * @param tenantId (Optional) The tenant ID to get a client for
     *
     * @returns A client, the credential used by the client, and the authentication function
     */
    private async getSubscriptionClient(_tenantId?: string, scopes?: string[]): Promise<{ client: SubscriptionClient, credential: TokenCredential, authentication: AzureAuthentication }> {
        const armSubs = await import('@azure/arm-resources-subscriptions');
        if (!this._tokenCredential) {
            throw new Error('Not signed in');
        }

        const accessToken = (await this._tokenCredential?.getToken("https://management.azure.com/.default"))?.token || '';
        return {
            client: new armSubs.SubscriptionClient(this._tokenCredential,),
            credential: this._tokenCredential,
            authentication: {
                getSession: (_scopes: string[] | undefined) => {
                    return {
                        accessToken,
                        id: this._tokenCredential?.tenantId || '',
                        account: {
                            id: this._tokenCredential?.tenantId || '',
                            label: this._tokenCredential?.tenantId || '',
                        },
                        tenantId: this._tokenCredential?.tenantId || '',
                        scopes: scopes || [],
                    };

                }
            }
        };
    }

    public onDidSignIn: Event<void> = () => { return new Disposable(() => { /*empty*/ }) };
    public onDidSignOut: Event<void> = () => { return new Disposable(() => { /*empty*/ }) };
}

/*
* @param serviceConnectionId The resource ID of the Azure DevOps federated service connection,
*   which can be found on the `resourceId` field of the URL at the address bar when viewing the service connection in the Azure DevOps portal
* @param domain The `Tenant ID` field of the service connection properties
* @param clientId The `Service Principal Id` field of the service connection properties
*/
async function getTokenCredential(serviceConnectionId: string, domain: string, clientId: string): Promise<TokenCredential> {
    if (!process.env.AGENT_BUILDDIRECTORY) {
        // Assume that AGENT_BUILDDIRECTORY is set if running in an Azure DevOps pipeline.
        // So when not running in an Azure DevOps pipeline, throw an error since we cannot use the DevOps federated service connection credential.
        throw new Error(`Cannot create DevOps federated service connection credential outside of an Azure DevOps pipeline.`);
    } else {
        console.log(`Creating DevOps federated service connection credential for service connection..`);

        // Pre-defined DevOps variable reference: https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops
        const systemAccessToken = process.env.SYSTEM_ACCESSTOKEN;
        const teamFoundationCollectionUri = process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI;
        const teamProjectId = process.env.SYSTEM_TEAMPROJECTID;
        const planId = process.env.SYSTEM_PLANID;
        const jobId = process.env.SYSTEM_JOBID;

        if (!systemAccessToken || !teamFoundationCollectionUri || !teamProjectId || !planId || !jobId) {
            throw new Error(`Azure DevOps environment variables are not set.\n
            process.env.SYSTEM_ACCESSTOKEN: ${process.env.SYSTEM_ACCESSTOKEN ? "✅" : "❌"}\n
            process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: ${process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI ? "✅" : "❌"}\n
            process.env.SYSTEM_TEAMPROJECTID: ${process.env.SYSTEM_TEAMPROJECTID ? "✅" : "❌"}\n
            process.env.SYSTEM_PLANID: ${process.env.SYSTEM_PLANID ? "✅" : "❌"}\n
            process.env.SYSTEM_JOBID: ${process.env.SYSTEM_JOBID ? "✅" : "❌"}\n
            REMEMBER: process.env.SYSTEM_ACCESSTOKEN must be explicitly mapped!\n
            https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml#systemaccesstoken
        `);
        }

        const oidcRequestUrl = `${teamFoundationCollectionUri}${teamProjectId}/_apis/distributedtask/hubs/build/plans/${planId}/jobs/${jobId}/oidctoken?api-version=7.1-preview.1&serviceConnectionId=${serviceConnectionId}`;

        const { ClientAssertionCredential } = await import("@azure/identity");
        return new ClientAssertionCredential(domain, clientId, async () => await requestOidcToken(oidcRequestUrl, systemAccessToken));
    }
}

/**
 * API reference: https://learn.microsoft.com/en-us/rest/api/azure/devops/distributedtask/oidctoken/create
 */
async function requestOidcToken(oidcRequestUrl: string, systemAccessToken: string): Promise<string> {
    const { ServiceClient } = await import('@azure/core-client');
    const { createHttpHeaders, createPipelineRequest } = await import('@azure/core-rest-pipeline');
    const genericClient = new ServiceClient();
    const request: PipelineRequest = createPipelineRequest({
        url: oidcRequestUrl,
        method: "POST",
        headers: createHttpHeaders({
            "Content-Type": "application/json",
            "Authorization": `Bearer ${systemAccessToken}`
        })
    });

    const response = await genericClient.sendRequest(request);
    const body: string = response.bodyAsText?.toString() || "";
    if (response.status !== 200) {
        throw new Error(`Failed to get OIDC token:\n
            Response status: ${response.status}\n
            Response body: ${body}\n
            Response headers: ${JSON.stringify(response.headers.toJSON())}
        `);
    } else {
        console.log(`Successfully got OIDC token with status ${response.status}`);
    }
    return (JSON.parse(body) as { oidcToken: string }).oidcToken;
}
