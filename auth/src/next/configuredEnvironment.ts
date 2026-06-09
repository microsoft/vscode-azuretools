/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { AzureAuthVsCode, VsCodeWorkspace } from './contracts/AzureAuthVsCode';
import { AzureChinaCloud, AzurePublicCloud, AzureUSGovernmentCloud, type EnvironmentLike } from './contracts/EnvironmentLike';

// These strings come from https://github.com/microsoft/vscode/blob/eac16e9b63a11885b538db3e0b533a02a2fb8143/extensions/microsoft-authentication/package.json#L40-L99
export const CustomCloudConfigurationSection = 'microsoft-sovereign-cloud';
const CloudEnvironmentSettingName = 'environment';
const CustomEnvironmentSettingName = 'customEnvironment';

/**
 * The possible values of the `microsoft-sovereign-cloud.environment` setting.
 */
enum CloudEnvironmentSettingValue {
    ChinaCloud = 'ChinaCloud',
    USGovernment = 'USGovernment',
    Custom = 'custom',
}

/**
 * The VS Code authentication provider ID for the public Azure cloud.
 */
export const PublicAuthProviderId = 'microsoft';

/**
 * The VS Code authentication provider ID for sovereign/custom Azure clouds.
 */
export const SovereignAuthProviderId = 'microsoft-sovereign-cloud';

/**
 * The result of resolving the configured Azure cloud environment.
 */
export interface ConfiguredAzureEnvironment {
    /**
     * The configured cloud environment.
     */
    readonly environment: EnvironmentLike;

    /**
     * Whether the configured environment is a custom (non-built-in) cloud.
     */
    readonly isCustomCloud: boolean;
}

type WorkspaceAndL10n = { readonly workspace: VsCodeWorkspace; readonly l10n: Pick<typeof vscode.l10n, 't'> };

/**
 * Gets the configured Azure cloud environment, using the injected `vscode` for the configuration lookup.
 *
 * @param vscode The injected VS Code namespace (or a narrowed shim) providing `workspace` and `l10n`.
 * @returns The configured {@link EnvironmentLike} and whether it is a custom cloud.
 * @throws An error if the `custom` cloud is selected but not configured.
 */
export function getConfiguredAzureEnv(vscode: WorkspaceAndL10n): ConfiguredAzureEnvironment {
    const authProviderConfig = vscode.workspace.getConfiguration(CustomCloudConfigurationSection);
    const environmentSettingValue = authProviderConfig.get<string | undefined>(CloudEnvironmentSettingName);

    if (environmentSettingValue === CloudEnvironmentSettingValue.ChinaCloud) {
        return { environment: AzureChinaCloud, isCustomCloud: false };
    } else if (environmentSettingValue === CloudEnvironmentSettingValue.USGovernment) {
        return { environment: AzureUSGovernmentCloud, isCustomCloud: false };
    } else if (environmentSettingValue === CloudEnvironmentSettingValue.Custom) {
        const customCloud = authProviderConfig.get<EnvironmentLike | undefined>(CustomEnvironmentSettingName);

        if (customCloud) {
            return { environment: customCloud, isCustomCloud: true };
        }

        throw new Error(vscode.l10n.t('The custom cloud choice is not configured. Please configure the setting `{0}.{1}`.', CustomCloudConfigurationSection, CustomEnvironmentSettingName));
    }

    return { environment: AzurePublicCloud, isCustomCloud: false };
}

/**
 * Gets the ID of the authentication provider configured to be used.
 *
 * @remarks The provider ID is derived from the configuration setting value, not from the environment name,
 * so a custom environment whose `name` happens to match a built-in cloud still resolves correctly.
 *
 * @param vscode The injected VS Code namespace (or a narrowed shim) providing `workspace`.
 * @returns The provider ID to use, either `'microsoft'` or `'microsoft-sovereign-cloud'`.
 */
export function getConfiguredAuthProviderId(vscode: { readonly workspace: VsCodeWorkspace }): string {
    const authProviderConfig = vscode.workspace.getConfiguration(CustomCloudConfigurationSection);
    const environmentSettingValue = authProviderConfig.get<string | undefined>(CloudEnvironmentSettingName);

    // Unset or empty means public cloud; any explicit value (China/USGov/custom) means sovereign cloud.
    return !environmentSettingValue ? PublicAuthProviderId : SovereignAuthProviderId;
}

/**
 * Sets the configured Azure cloud.
 *
 * @param vscode The injected VS Code namespace (or a narrowed shim) providing `workspace` and `ConfigurationTarget`.
 * @param cloud Use `'AzureCloud'` or `undefined` for public Azure cloud, `'ChinaCloud'` for Azure China, or
 * `'USGovernment'` for Azure US Government. For a custom cloud, pass an {@link EnvironmentLike}.
 * @param target (Optional) The configuration target to use, by default `ConfigurationTarget.Global`.
 */
export async function setConfiguredAzureEnv(
    vscode: { readonly workspace: VsCodeWorkspace; readonly ConfigurationTarget: AzureAuthVsCode['ConfigurationTarget'] },
    cloud: 'AzureCloud' | 'ChinaCloud' | 'USGovernment' | undefined | null | EnvironmentLike,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global,
): Promise<void> {
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
        // Use a custom cloud--set the `environment` setting to `custom` and the `customEnvironment` setting to the specified value
        await authProviderConfig.update(CloudEnvironmentSettingName, CloudEnvironmentSettingValue.Custom, target);
        await authProviderConfig.update(CustomEnvironmentSettingName, cloud, target);
    } else {
        throw new Error(`Invalid cloud value: ${JSON.stringify(cloud)}`);
    }
}
