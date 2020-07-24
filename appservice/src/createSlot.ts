/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from "@azure/arm-appservice";
import { ProgressLocation, window } from "vscode";
import { AzureTreeItem, createAzureClient, IAzureNamingRules, IAzureQuickPickItem, ICreateChildImplContext } from "vscode-azureextensionui";
import { getNewFileShareName } from "./createAppService/getNewFileShareName";
import { ext } from "./extensionVariables";
import { localize } from "./localize";
import { SiteClient } from './SiteClient';
import { ISiteTreeRoot } from "./tree/ISiteTreeRoot";

export async function createSlot(root: ISiteTreeRoot, existingSlots: AzureTreeItem<ISiteTreeRoot>[], context: ICreateChildImplContext): Promise<WebSiteManagementModels.Site> {
    const client: WebSiteManagementClient = createAzureClient(root, WebSiteManagementClient);
    const slotName: string = (await ext.ui.showInputBox({
        prompt: localize('enterSlotName', 'Enter a unique name for the new deployment slot'),
        validateInput: async (value: string): Promise<string | undefined> => validateSlotName(value, client, root)
    })).trim();

    const newDeploymentSlot: WebSiteManagementModels.Site = {
        name: slotName,
        kind: root.client.kind,
        location: root.client.location,
        serverFarmId: root.client.serverFarmId,
        siteConfig: {
            appSettings: [] // neccesary to have clean appSettings; by default it copies the production's slot
        }
    };

    const configurationSource: SiteClient | undefined = await chooseConfigurationSource(root, existingSlots);
    if (!!configurationSource) {
        const appSettings: WebSiteManagementModels.NameValuePair[] = await parseAppSettings(configurationSource);
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
    } else if (value.length < slotNamingRules.minLength) {
        return localize('nameTooShort', 'The slot name must be at least {0} characters.', slotNamingRules.minLength);
    } else if (value.length + root.client.siteName.length > slotNamingRules.maxLength) {
        return localize('nameTooLong', 'The combined site name and slot name must be fewer than {0} characters.', slotNamingRules.maxLength);
    } else if (slotNamingRules.invalidCharsRegExp.test(value)) {
        return localize('invalidChars', "The name can only contain letters, numbers, or hyphens.");
    } else {
        const nameAvailability: WebSiteManagementModels.ResourceNameAvailability = await client.checkNameAvailability(`${root.client.siteName}-${value}`, 'Slot');
        if (!nameAvailability.nameAvailable) {
            return nameAvailability.message;
        } else {
            return undefined;
        }
    }
}

async function chooseConfigurationSource(root: ISiteTreeRoot, existingSlots: AzureTreeItem<ISiteTreeRoot>[]): Promise<SiteClient | undefined> {
    if (root.client.isFunctionApp) {
        // Function apps always clone from production slot without prompting
        return root.client;
    } else {
        const configurationSources: IAzureQuickPickItem<SiteClient | undefined>[] = [{
            label: localize('dontClone', "Don't clone configuration from an existing slot"),
            data: undefined
        }];

        const prodSiteClient: SiteClient = root.client;
        // add the production slot itself
        configurationSources.push({
            // tslint:disable-next-line:no-non-null-assertion
            label: prodSiteClient.fullName,
            data: prodSiteClient
        });

        // add the web app's current deployment slots
        for (const slot of existingSlots) {
            const slotSiteClient: SiteClient = slot.root.client;
            configurationSources.push({
                label: slotSiteClient.fullName,
                data: slotSiteClient
            });
        }

        const placeHolder: string = localize('chooseSource', 'Choose a configuration source.');
        return (await ext.ui.showQuickPick(configurationSources, { placeHolder })).data;
    }
}

async function parseAppSettings(siteClient: SiteClient): Promise<WebSiteManagementModels.NameValuePair[]> {
    const appSettings: WebSiteManagementModels.StringDictionary = await siteClient.listApplicationSettings();
    const appSettingPairs: WebSiteManagementModels.NameValuePair[] = [];
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
