/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import WebSiteManagementClient from 'azure-arm-website';
import { NameValuePair, ResourceNameAvailability, Site, StringDictionary } from 'azure-arm-website/lib/models';
import { ProgressLocation, window } from 'vscode';
import { AzureTreeItem, createAzureClient, IAzureNamingRules, IAzureQuickPickItem, ICreateChildImplContext } from 'vscode-azureextensionui';
import { ISiteClient } from './';
import { getNewFileShareName } from './createAppService/getNewFileShareName';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { ISiteTreeRoot } from './tree/ISiteTreeRoot';

export async function createSlot(root: ISiteTreeRoot, existingSlots: AzureTreeItem<ISiteTreeRoot>[], context: ICreateChildImplContext): Promise<Site> {
    const client: WebSiteManagementClient = createAzureClient(root, WebSiteManagementClient);
    const slotName: string = (await ext.ui.showInputBox({
        prompt: localize('enterSlotName', 'Enter a unique name for the new deployment slot'),
        validateInput: async (value: string): Promise<string | undefined> => validateSlotName(value, client, root)
    })).trim();

    const newDeploymentSlot: Site = {
        name: slotName,
        kind: root.client.kind,
        location: root.client.location,
        serverFarmId: root.client.serverFarmId,
        siteConfig: {
            appSettings: [] // neccesary to have clean appSettings; by default it copies the production's slot
        }
    };

    const configurationSource: ISiteClient | undefined = await chooseConfigurationSource(root, existingSlots);
    if (!!configurationSource) {
        const appSettings: NameValuePair[] = await parseAppSettings(configurationSource);
        // tslint:disable-next-line:no-non-null-assertion
        newDeploymentSlot.siteConfig!.appSettings = appSettings;
    }

    context.showCreatingTreeItem(slotName);

    const creatingSlot: string = localize('creatingSlot', 'Creating slot "{0}"...', slotName);
    ext.outputChannel.appendLog(creatingSlot);
    return await window.withProgress({ location: ProgressLocation.Notification, title: creatingSlot }, async () => {
        return await client.webApps.createOrUpdateSlot(root.client.resourceGroup, root.client.siteName, newDeploymentSlot, slotName);
    });
}

const slotNamingRules: IAzureNamingRules = {
    minLength: 2,
    maxLength: 59,
    invalidCharsRegExp: /[^a-zA-Z0-9\-]/
};

async function validateSlotName(value: string, client: WebSiteManagementClient, root: ISiteTreeRoot): Promise<string | undefined> {
    value = value.trim();
    // Can not have "production" as a slot name, but checkNameAvailability doesn't validate that
    if (value === 'production') {
        return localize('slotNotAvailable', 'The slot name "{0}" is not available.', value);
    } else if (value.length < slotNamingRules.minLength || value.length > slotNamingRules.maxLength) {
        return localize('invalidLength', 'The name must be between {0} and {1} characters.', slotNamingRules.minLength, slotNamingRules.maxLength);
    } else if (slotNamingRules.invalidCharsRegExp.test(value)) {
        return localize('invalidChars', "The name can only contain letters, numbers, or hyphens.");
    } else {
        const nameAvailability: ResourceNameAvailability = await client.checkNameAvailability(`${root.client.siteName}-${value}`, 'Slot');
        if (!nameAvailability.nameAvailable) {
            return nameAvailability.message;
        } else {
            return undefined;
        }
    }
}

async function chooseConfigurationSource(root: ISiteTreeRoot, existingSlots: AzureTreeItem<ISiteTreeRoot>[]): Promise<ISiteClient | undefined> {
    if (root.client.isFunctionApp) {
        // Function apps always clone from production slot without prompting
        return root.client;
    } else {
        const configurationSources: IAzureQuickPickItem<ISiteClient | undefined>[] = [{
            label: localize('dontClone', "Don't clone configuration from an existing slot"),
            data: undefined
        }];

        const prodSiteClient: ISiteClient = root.client;
        // add the production slot itself
        configurationSources.push({
            // tslint:disable-next-line:no-non-null-assertion
            label: prodSiteClient.fullName,
            data: prodSiteClient
        });

        // add the web app's current deployment slots
        for (const slot of existingSlots) {
            const slotSiteClient: ISiteClient = slot.root.client;
            configurationSources.push({
                label: slotSiteClient.fullName,
                data: slotSiteClient
            });
        }

        const placeHolder: string = localize('chooseSource', 'Choose a configuration source.');
        return (await ext.ui.showQuickPick(configurationSources, { placeHolder })).data;
    }
}

async function parseAppSettings(siteClient: ISiteClient): Promise<NameValuePair[]> {
    const appSettings: StringDictionary = await siteClient.listApplicationSettings();
    const appSettingPairs: NameValuePair[] = [];
    if (appSettings.properties) {
        // iterate String Dictionary to parse into NameValuePair[]
        for (const key of Object.keys(appSettings.properties)) {
            let value: string = appSettings.properties[key];
            // This has to be different when cloning configuration for a function app slot
            if (siteClient.isFunctionApp && key === 'WEBSITE_CONTENTSHARE') {
                value = getNewFileShareName(siteClient.fullName);
            }
            appSettingPairs.push({ name: key, value });
        }
    }
    return appSettingPairs;
}
