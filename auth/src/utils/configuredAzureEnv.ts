/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureEnv from '@azure/ms-rest-azure-env'; // This package is so small that it's not worth lazy loading
import * as vscode from 'vscode';

const AzureCloudName = azureEnv.Environment.AzureCloud.name;
const AzureChinaCloudName = azureEnv.Environment.ChinaCloud.name;
const AzureUSGovernmentCloudName = azureEnv.Environment.USGovernment.name;

const CloudNameToEndpointSettingValue: { [cloudName: string]: string | undefined } = {};
CloudNameToEndpointSettingValue[AzureCloudName] = undefined;
CloudNameToEndpointSettingValue[AzureChinaCloudName] = 'Azure China';
CloudNameToEndpointSettingValue[AzureUSGovernmentCloudName] = 'Azure US Government';

/**
 * Gets the configured Azure environment.
 *
 * @returns The configured Azure environment from the `microsoft-sovereign-cloud.endpoint` setting.
 */
export function getConfiguredAzureEnv(): azureEnv.Environment & { isCustomCloud: boolean } {
    const authProviderConfig = vscode.workspace.getConfiguration('microsoft-sovereign-cloud');
    const endpointSettingValue = authProviderConfig.get<string | undefined>('endpoint')?.toLowerCase();

    // The endpoint setting will accept either the environment name (either 'Azure China' or 'Azure US Government'),
    // or an endpoint URL. Since the user could configure the same environment either way, we need to check both.
    // We'll also throw to lowercase just to maximize the chance of success.

    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    if (endpointSettingValue === CloudNameToEndpointSettingValue[AzureChinaCloudName]!.toLowerCase() || endpointSettingValue === azureEnv.Environment.ChinaCloud.activeDirectoryEndpointUrl.toLowerCase()) {
        return {
            ...azureEnv.Environment.ChinaCloud,
            isCustomCloud: false,
        };
    } else if (endpointSettingValue === CloudNameToEndpointSettingValue[AzureUSGovernmentCloudName]!.toLowerCase() || endpointSettingValue === azureEnv.Environment.USGovernment.activeDirectoryEndpointUrl.toLowerCase()) {
        return {
            ...azureEnv.Environment.USGovernment,
            isCustomCloud: false,
        };
    } else if (endpointSettingValue) {
        // TODO: support custom clouds
        throw new Error('Custom clouds are not supported yet');
        // return {
        //     ...configuredCustomCloud,
        //     isCustomCloud: true,
        // };
    }
    /* eslint-enable @typescript-eslint/no-non-null-assertion */

    return {
        ...azureEnv.Environment.AzureCloud,
        isCustomCloud: false,
    };
}

/**
 * Sets the configured Azure cloud.
 *
 * @param cloud Use `'AzureCloud'` for public Azure cloud, `'AzureChinaCloud'` for Azure China, or `'AzureUSGovernment'` for Azure US Government.
 * These are the same values as the cloud names in `@azure/ms-rest-azure-env`. For a custom cloud, use an instance of the `@azure/ms-rest-azure-env` `Environment` class.
 *
 * @param target (Optional) The configuration target to use, by default {@link vscode.ConfigurationTarget.Global}.
 */
export async function setConfiguredAzureEnv(cloud: string | azureEnv.Environment, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    const authProviderConfig = vscode.workspace.getConfiguration('microsoft-sovereign-cloud');

    if (typeof cloud === 'string' && cloud in CloudNameToEndpointSettingValue) {
        await authProviderConfig.update('endpoint', CloudNameToEndpointSettingValue[cloud], target);
    } else if (typeof cloud === 'object' && 'activeDirectoryEndpointUrl' in cloud) {
        // TODO: support more custom cloud settings
        await authProviderConfig.update('endpoint', cloud.activeDirectoryEndpointUrl, target);
    } else {
        throw new Error(`Invalid cloud value: ${JSON.stringify(cloud)}`);
    }
}

/**
 * Gets the ID of the authentication provider configured to be used
 * @returns The provider ID to use, either `'microsoft'` or `'microsoft-sovereign-cloud'`
 */
export function getConfiguredAuthProviderId(): string {
    return getConfiguredAzureEnv().name === AzureCloudName ? 'microsoft' : 'microsoft-sovereign-cloud';
}
