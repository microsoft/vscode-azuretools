/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzureLogger } from '@azure/logger';
import type { CredentialFactory } from './AzureSubscriptionProviderBase';
import { getConfiguredAuthProviderId, getConfiguredAzureEnv } from './configuredEnvironment';
import type { AzureAuthVsCode } from './contracts/AzureAuthVsCode';
import { VsCodeExtensionCredential } from './VsCodeExtensionCredential';

/**
 * Creates the default {@link CredentialFactory} that produces a per-tenant {@link VsCodeExtensionCredential}
 * backed by the injected VS Code authentication namespace. The configured cloud environment and auth
 * provider are resolved lazily (per token request) so that configuration changes are honored.
 *
 * @param vscode The injected VS Code namespace (or a narrowed shim) used for authentication and configuration.
 * @param logger (Optional) A logger for auth lifecycle logging.
 * @returns A {@link CredentialFactory} suitable for the VS Code subscription providers.
 */
export function createVsCodeCredentialFactory(vscode: AzureAuthVsCode, logger?: AzureLogger): CredentialFactory {
    return (tenant) => new VsCodeExtensionCredential({
        authentication: vscode.authentication,
        tenantId: tenant.tenantId,
        environment: getConfiguredAzureEnv(vscode).environment,
        authProviderId: getConfiguredAuthProviderId(vscode),
        logger,
        sessionOptions: { createIfNone: false, silent: true, account: tenant.account },
    });
}
