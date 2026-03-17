/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { NameValuePair, Site, StringDictionary, WebSiteManagementClient } from '@azure/arm-appservice';
import { AzureWizardExecuteStep, nonNullProp } from '@microsoft/vscode-azext-utils';
import { ProgressLocation, l10n, window } from 'vscode';
import { ParsedSite } from '../SiteClient';
import { getNewFileShareName } from '../createAppService/getNewFileShareName';
import { ext } from '../extensionVariables';
import { createWebSiteClient } from '../utils/azureClients';
import { ICreateSlotContext } from './ICreateSlotContext';

export class DeploymentSlotCreateStep extends AzureWizardExecuteStep<ICreateSlotContext> {
    public priority: number = 250;

    public async execute(context: ICreateSlotContext): Promise<void> {
        const parentSite: ParsedSite = nonNullProp(context, 'parentSite');
        const slotName: string = nonNullProp(context, 'newDeploymentSlotName');
        const client: WebSiteManagementClient = await createWebSiteClient([context, parentSite.subscription]);

        const newDeploymentSlot: Site = {
            name: slotName,
            kind: parentSite.kind,
            location: parentSite.location,
            serverFarmId: parentSite.serverFarmId,
            siteConfig: {
                appSettings: [] // necessary to have clean appSettings; by default it copies the production's slot
            }
        };

        const configurationSource = context.newDeploymentSlotConfigSource;
        if (configurationSource) {
            const appSettings: NameValuePair[] = await parseAppSettings(context, configurationSource);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            newDeploymentSlot.siteConfig!.appSettings = appSettings;
        }

        context.showCreatingTreeItem(slotName);

        const creatingSlot: string = l10n.t('Creating slot "{0}"...', slotName);
        ext.outputChannel.appendLog(creatingSlot);
        context.site = await window.withProgress({ location: ProgressLocation.Notification, title: creatingSlot }, async () => {
            return await client.webApps.beginCreateOrUpdateSlotAndWait(parentSite.resourceGroup, parentSite.siteName, slotName, newDeploymentSlot);
        });
    }

    public shouldExecute(context: ICreateSlotContext): boolean {
        return !context.site;
    }
}

async function parseAppSettings(context: ICreateSlotContext, site: ParsedSite): Promise<NameValuePair[]> {
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
