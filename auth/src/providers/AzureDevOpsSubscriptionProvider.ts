/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureSubscriptionProviderBase } from '../next/AzureSubscriptionProviderBase';
import type { AzureAccount } from '../next/contracts/AzureAccount';
import type { AzureTenant } from '../next/contracts/AzureTenant';
import { AzurePublicCloud, type EnvironmentLike } from '../next/contracts/EnvironmentLike';
import { AzureDevOpsCredential } from '../next/testing';
import { createAzureLoggerForOutputChannel } from './azureLoggerForOutputChannel';

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
 * A credential-first {@link AzureSubscriptionProviderBase} that authenticates via a federated Azure DevOps
 * service connection, using workflow identity federation. It supplies an {@link AzureDevOpsCredential} as
 * the provider's credential factory and exposes a single fixed account and tenant (the service principal).
 * The produced subscriptions expose their {@link TokenCredential} via `credential`; the legacy
 * per-subscription `authentication` member is not provided.
 *
 * To learn how to configure your DevOps environment to use this provider, refer to the README.md.
 * NOTE: This provider is only usable when running in an Azure DevOps pipeline.
 * Reference: https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation
 */
export class AzureDevOpsSubscriptionProvider extends AzureSubscriptionProviderBase {
    private readonly devOpsCredential: AzureDevOpsCredential;
    private readonly devOpsTenantId: string;

    public constructor({ serviceConnectionId, tenantId, clientId }: AzureDevOpsSubscriptionProviderInitializer, logger?: vscode.LogOutputChannel) {
        // `AzureDevOpsCredential` validates that the initializer values are present.
        const credential = new AzureDevOpsCredential({ serviceConnectionId, tenantId, clientId });
        super({
            vscode: vscode,
            logger: logger ? createAzureLoggerForOutputChannel(logger) : undefined,
            credentialFactory: () => credential,
        });
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
        // Acquire a token to ensure the federated credential is usable. Federated identity has no
        // interactive sign-in, so this just probes the credential.
        const token = await this.devOpsCredential.getToken(`${ensureEndingSlash(AzurePublicCloud.managementEndpointUrl)}.default`);
        return !!token;
    }

    /**
     * For {@link AzureDevOpsSubscriptionProvider}, interactive challenges cannot be satisfied (there is no
     * user to prompt in a pipeline), so this always throws.
     */
    protected override getTokenForChallenge(): Promise<string | undefined> {
        throw new Error('Getting a session with a challenge is not supported in AzureDevOpsSubscriptionProvider.');
    }
}
