/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CheckNameAvailabilityResponse, NameValuePair, Site, StringDictionary, WebSiteManagementClient } from "@azure/arm-appservice";
import { ServiceClient } from '@azure/core-client';
import { createGenericClient } from "@microsoft/vscode-azext-azureutils";
import { IActionContext, IAzureNamingRules, IAzureQuickPickItem, ICreateChildImplContext } from "@microsoft/vscode-azext-utils";
import { ProgressLocation, l10n, window } from "vscode";
import { ParsedSite } from './SiteClient';
import { getNewFileShareName } from "./createAppService/getNewFileShareName";
import { ext } from "./extensionVariables";
import { createWebSiteClient } from "./utils/azureClients";
import { checkNameAvailability } from "./utils/azureUtils";

export async function createSlot(site: ParsedSite, existingSlots: ParsedSite[], context: ICreateChildImplContext): Promise<Site> {
    const client: WebSiteManagementClient = await createWebSiteClient([context, site.subscription]);
    const gClient = await createGenericClient(context, site.subscription);
    const slotName: string = (await context.ui.showInputBox({
        prompt: l10n.t('Enter a unique name for the new deployment slot'),
        stepName: 'slotName',
        validateInput: async (value: string): Promise<string | undefined> => validateSlotName(value, gClient, site)
    })).trim();

    const newDeploymentSlot: Site = {
        name: slotName,
        kind: site.kind,
        location: site.location,
        serverFarmId: site.serverFarmId,
        siteConfig: {
            appSettings: [] // neccesary to have clean appSettings; by default it copies the production's slot
        }
    };

    const configurationSource = await chooseConfigurationSource(context, site, existingSlots);
    if (configurationSource) {
        const appSettings: NameValuePair[] = await parseAppSettings(context, configurationSource);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        newDeploymentSlot.siteConfig!.appSettings = appSettings;
    }

    context.showCreatingTreeItem(slotName);

    const creatingSlot: string = l10n.t('Creating slot "{0}"...', slotName);
    ext.outputChannel.appendLog(creatingSlot);
    return await window.withProgress({ location: ProgressLocation.Notification, title: creatingSlot }, async () => {
        return await client.webApps.beginCreateOrUpdateSlotAndWait(site.resourceGroup, site.siteName, slotName, newDeploymentSlot);
    });
}

const slotNamingRules: IAzureNamingRules = {
    minLength: 2,
    maxLength: 59,
    invalidCharsRegExp: /[^a-zA-Z0-9\-]/
};

async function validateSlotName(value: string, client: ServiceClient, site: ParsedSite): Promise<string | undefined> {
    value = value.trim();
    // Can not have "production" as a slot name, but checkNameAvailability doesn't validate that
    if (value === 'production') {
        return l10n.t('The slot name "{0}" is not available.', value);
    } else if (value.length < slotNamingRules.minLength) {
        return l10n.t('The slot name must be at least {0} characters.', slotNamingRules.minLength);
    } else if (value.length + site.siteName.length > slotNamingRules.maxLength) {
        return l10n.t('The combined site name and slot name must be fewer than {0} characters.', slotNamingRules.maxLength);
    } else if (slotNamingRules.invalidCharsRegExp.test(value)) {
        return l10n.t("The name can only contain letters, numbers, or hyphens.");
    } else {
        const nameAvailability: CheckNameAvailabilityResponse = await checkNameAvailability(client, site.subscription.subscriptionId, `${site.siteName}-${value}`, 'Slot');
        if (!nameAvailability.nameAvailable) {
            return nameAvailability.message;
        } else {
            return undefined;
        }
    }
}

async function chooseConfigurationSource(context: IActionContext, site: ParsedSite, existingSlots: ParsedSite[]): Promise<ParsedSite | undefined> {
    if (site.isFunctionApp) {
        // Function apps always clone from production slot without prompting
        return site;
    } else {
        const configurationSources: IAzureQuickPickItem<ParsedSite | undefined>[] = [{
            label: l10n.t("Don't clone configuration from an existing slot"),
            data: undefined
        }];

        // add the production slot itself
        configurationSources.push({
            label: site.fullName,
            data: site
        });

        // add the web app's current deployment slots
        for (const slot of existingSlots) {
            configurationSources.push({
                label: slot.fullName,
                data: slot
            });
        }

        const placeHolder: string = l10n.t('Choose a configuration source.');
        return (await context.ui.showQuickPick(configurationSources, { placeHolder, stepName: 'slotConfigSource' })).data;
    }
}

async function parseAppSettings(context: IActionContext, site: ParsedSite): Promise<NameValuePair[]> {
    const client = await site.createClient(context);
    const appSettings: StringDictionary = await client.listApplicationSettings();
    const appSettingPairs: NameValuePair[] = [];
    if (appSettings.properties) {
        // iterate String Dictionary to parse into NameValuePair[]
        for (const key of Object.keys(appSettings.properties)) {
            let value: string = appSettings.properties[key];
            // This has to be different when cloning configuration for a function app slot
            if (site.isFunctionApp && key === 'WEBSITE_CONTENTSHARE') {
                value = getNewFileShareName(site.fullName);
            }
            appSettingPairs.push({ name: key, value });
        }
    }
    return appSettingPairs;
}
