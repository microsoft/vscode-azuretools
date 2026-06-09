/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/core-auth';

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
