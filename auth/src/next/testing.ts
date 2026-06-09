/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TokenCredential } from '@azure/core-auth';

/**
 * Options for {@link createAzureDevOpsCredential}.
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
}

/**
 * Creates a {@link TokenCredential} that authenticates to Azure via an Azure DevOps federated service
 * connection, using workflow identity federation. This resolves the system access token from the
 * environment (unless overridden) and returns `@azure/identity`'s `AzurePipelinesCredential`.
 *
 * `@azure/identity` is imported lazily, so importing this module does not eagerly bundle it.
 *
 * NOTE: This credential is only usable when running in an Azure DevOps pipeline, unless
 * {@link AzureDevOpsCredentialOptions.allowOutsidePipeline} is set.
 *
 * @param options The {@link AzureDevOpsCredentialOptions}.
 * @returns The `AzurePipelinesCredential` as a {@link TokenCredential}.
 * @see https://learn.microsoft.com/entra/workload-id/workload-identity-federation
 */
export async function createAzureDevOpsCredential(options: AzureDevOpsCredentialOptions): Promise<TokenCredential> {
    const { serviceConnectionId, tenantId, clientId } = options;
    if (!serviceConnectionId || !tenantId || !clientId) {
        throw new Error(`Missing initializer values to identify Azure DevOps federated service connection\n
            Values provided:\n
            serviceConnectionId: ${serviceConnectionId ? "✅" : "❌"}\n
            tenantId: ${tenantId ? "✅" : "❌"}\n
            clientId: ${clientId ? "✅" : "❌"}\n
        `);
    }

    const systemAccessToken = options.systemAccessToken ?? process.env.SYSTEM_ACCESSTOKEN;

    if (!options.allowOutsidePipeline && !process.env.AGENT_BUILDDIRECTORY) {
        // Assume that AGENT_BUILDDIRECTORY is set if running in an Azure DevOps pipeline.
        throw new Error('Cannot create DevOps federated service connection credential outside of an Azure DevOps pipeline.');
    } else if (!systemAccessToken) {
        throw new Error('Cannot create DevOps federated service connection credential because the SYSTEM_ACCESSTOKEN environment variable is not set.');
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore @azure/identity contains a bug where this type mismatches between CJS and ESM, we must ignore it. We also can't do @ts-expect-error because the error only happens when building CJS.
    const azIdentity: typeof import('@azure/identity') = await import('@azure/identity');
    return new azIdentity.AzurePipelinesCredential(tenantId, clientId, serviceConnectionId, systemAccessToken);
}
