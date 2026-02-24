/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureEnv from '@azure/ms-rest-azure-env'; // This package is so small that it's not worth lazy loading
import * as vscode from 'vscode';

// These strings come from https://github.com/microsoft/vscode/blob/eac16e9b63a11885b538db3e0b533a02a2fb8143/extensions/microsoft-authentication/package.json#L40-L99
const CustomCloudConfigurationSection = 'microsoft-sovereign-cloud';
const CloudEnvironmentSettingName = 'environment';
const CustomEnvironmentSettingName = 'customEnvironment';

enum CloudEnvironmentSettingValue {
    ChinaCloud = 'ChinaCloud',
    USGovernment = 'USGovernment',
    Custom = 'custom',
}

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
 * @returns The configured Azure environment from the settings in the built-in authentication provider extension
 */
export function getConfiguredAzureEnv(): ExtendedEnvironment {
    const authProviderConfig = vscode.workspace.getConfiguration(CustomCloudConfigurationSection);
    const environmentSettingValue = authProviderConfig.get<string | undefined>(CloudEnvironmentSettingName);

    if (environmentSettingValue === CloudEnvironmentSettingValue.ChinaCloud) {
        return new ExtendedEnvironment(azureEnv.Environment.ChinaCloud, false);
    } else if (environmentSettingValue === CloudEnvironmentSettingValue.USGovernment) {
        return new ExtendedEnvironment(azureEnv.Environment.USGovernment, false);
    } else if (environmentSettingValue === CloudEnvironmentSettingValue.Custom) {
        const customCloud = authProviderConfig.get<azureEnv.EnvironmentParameters | undefined>(CustomEnvironmentSettingName);

        if (customCloud) {
            return new ExtendedEnvironment(customCloud, true);
        }

        throw new Error(vscode.l10n.t('The custom cloud choice is not configured. Please configure the setting `{0}.{1}`.', CustomCloudConfigurationSection, CustomEnvironmentSettingName));
    }

    return new ExtendedEnvironment(azureEnv.Environment.AzureCloud, false);
}

/**
 * Sets the configured Azure cloud.
 *
 * @param cloud Use `'AzureCloud'` or `undefined` for public Azure cloud, `'ChinaCloud'` for Azure China, or `'USGovernment'` for Azure US Government.
 * These are the same values as the cloud names in `@azure/ms-rest-azure-env`. For a custom cloud, use an instance of the `@azure/ms-rest-azure-env` {@link azureEnv.EnvironmentParameters}.
 *
 * @param target (Optional) The configuration target to use, by default {@link vscode.ConfigurationTarget.Global}.
 */
export async function setConfiguredAzureEnv(cloud: 'AzureCloud' | 'ChinaCloud' | 'USGovernment' | undefined | null | azureEnv.EnvironmentParameters, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    const authProviderConfig = vscode.workspace.getConfiguration(CustomCloudConfigurationSection);

    if (typeof cloud === 'undefined' || !cloud) {
        // Use public cloud implicitly--set `environment` setting to `undefined`
        await authProviderConfig.update(CloudEnvironmentSettingName, undefined, target);
    } else if (typeof cloud === 'string' && cloud === 'AzureCloud') {
        // Use public cloud explicitly--set `environment` setting to `undefined`
        await authProviderConfig.update(CloudEnvironmentSettingName, undefined, target);
    } else if (typeof cloud === 'string') {
        // Use a sovereign cloud--set the `environment` setting to the specified value
        await authProviderConfig.update(CloudEnvironmentSettingName, cloud, target);
    } else if (typeof cloud === 'object') {
        // use a custom cloud--set the `environment` setting to `custom` and the `customEnvironment` setting to the specified value
        await authProviderConfig.update(CloudEnvironmentSettingName, CloudEnvironmentSettingValue.Custom, target);
        await authProviderConfig.update(CustomEnvironmentSettingName, cloud, target);
    } else {
        throw new Error(`Invalid cloud value: ${JSON.stringify(cloud)}`);
    }
}

/**
 * Gets the ID of the authentication provider configured to be used
 * @returns The provider ID to use, either `'microsoft'` or `'microsoft-sovereign-cloud'`
 */
export function getConfiguredAuthProviderId(): string {
    return getConfiguredAzureEnv().name === azureEnv.Environment.AzureCloud.name ? 'microsoft' : 'microsoft-sovereign-cloud';
}
