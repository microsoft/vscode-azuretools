/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureEnv from '@azure/ms-rest-azure-env'; // This package is so small that it's not worth lazy loading
import * as vscode from 'vscode';
import { AzureChinaCloud, AzureUSGovernmentCloud } from '../next/contracts/EnvironmentLike';
import { getConfiguredAuthProviderId as nextGetConfiguredAuthProviderId, getConfiguredAzureEnv as nextGetConfiguredAzureEnv, setConfiguredAzureEnv as nextSetConfiguredAzureEnv } from '../next/configuredEnvironment';

export class ExtendedEnvironment extends azureEnv.Environment {
    public constructor(parameters: azureEnv.EnvironmentParameters, public readonly isCustomCloud: boolean) {
        super(parameters);
        // The Environment constructor only copies required properties. Copy all remaining
        // optional properties (e.g. storageEndpointSuffix, keyVaultDnsSuffix) from the source.
        Object.assign(this, parameters);
    }
}

/**
 * Gets the configured Azure environment.
 *
 * @remarks This delegates the configuration lookup to the dependency-injected `./next`
 * {@link nextGetConfiguredAzureEnv}, then maps the structural {@link EnvironmentLike} back to an
 * `@azure/ms-rest-azure-env`-based {@link ExtendedEnvironment} for backwards compatibility.
 *
 * @returns The configured Azure environment from the settings in the built-in authentication provider extension
 */
export function getConfiguredAzureEnv(): ExtendedEnvironment {
    const { environment, isCustomCloud } = nextGetConfiguredAzureEnv(vscode);

    if (isCustomCloud) {
        return new ExtendedEnvironment(environment, true);
    }

    switch (environment) {
        case AzureChinaCloud:
            return new ExtendedEnvironment(azureEnv.Environment.ChinaCloud, false);
        case AzureUSGovernmentCloud:
            return new ExtendedEnvironment(azureEnv.Environment.USGovernment, false);
        default:
            return new ExtendedEnvironment(azureEnv.Environment.AzureCloud, false);
    }
}

/**
 * Sets the configured Azure cloud.
 *
 * @remarks This is a thin wrapper around the dependency-injected `./next` {@link nextSetConfiguredAzureEnv},
 * binding it to the real `vscode` namespace.
 *
 * @param cloud Use `'AzureCloud'` or `undefined` for public Azure cloud, `'ChinaCloud'` for Azure China, or `'USGovernment'` for Azure US Government.
 * These are the same values as the cloud names in `@azure/ms-rest-azure-env`. For a custom cloud, use an instance of the `@azure/ms-rest-azure-env` {@link azureEnv.EnvironmentParameters}.
 *
 * @param target (Optional) The configuration target to use, by default {@link vscode.ConfigurationTarget.Global}.
 */
export async function setConfiguredAzureEnv(cloud: 'AzureCloud' | 'ChinaCloud' | 'USGovernment' | undefined | null | azureEnv.EnvironmentParameters, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    await nextSetConfiguredAzureEnv(vscode, cloud, target);
}

/**
 * Gets the ID of the authentication provider configured to be used
 *
 * @remarks This is a thin wrapper around the dependency-injected `./next` {@link nextGetConfiguredAuthProviderId},
 * binding it to the real `vscode` namespace.
 *
 * @returns The provider ID to use, either `'microsoft'` or `'microsoft-sovereign-cloud'`
 */
export function getConfiguredAuthProviderId(): string {
    return nextGetConfiguredAuthProviderId(vscode);
}
