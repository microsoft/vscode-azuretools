/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from '@azure/arm-appservice';
import { AzureNameStep, IAzureNamingRules, ResourceGroupListStep, resourceGroupNamingRules, StorageAccountListStep, storageAccountNamingRules } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { createWebSiteClient } from '../utils/azureClients';
import { appInsightsNamingRules } from './AppInsightsListStep';
import { AppKind } from './AppKind';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { appServicePlanNamingRules } from './AppServicePlanNameStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

const siteNamingRules: IAzureNamingRules = {
    minLength: 2,
    maxLength: 60,
    invalidCharsRegExp: /[^a-zA-Z0-9\-]/
};

export class SiteNameStep extends AzureNameStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        const client: WebSiteManagementClient = await createWebSiteClient(wizardContext);

        let placeHolder: string | undefined;
        if (wizardContext.environment.name === 'Azure') {
            // Unfortunately, the environment object doesn't have the url we need for this placeholder. Might be fixed in the new sdk: https://github.com/microsoft/vscode-azuretools/issues/510
            // For now, we'll only display this placeholder for the most common case
            let namePlaceholder: string;
            if (wizardContext.newSiteKind === AppKind.functionapp) {
                namePlaceholder = localize('funcAppName', 'function app name');
            } else if (wizardContext.newSiteKind === AppKind.workflowapp) {
                namePlaceholder = localize('logicAppName', 'logic app name');
            } else {
                namePlaceholder = localize('webAppName', 'web app name');
            } 
            placeHolder = `<${namePlaceholder}>.azurewebsites.net`;
        }

        let prompt: string;
        if (wizardContext.newSiteKind === AppKind.functionapp) {
            prompt = localize('functionAppNamePrompt', 'Enter a globally unique name for the new function app.');
        } else if (wizardContext.newSiteKind === AppKind.workflowapp) {
            prompt = localize('functionAppNamePrompt', 'Enter a globally unique name for the new logic app.');
        } else {
            prompt = localize('webAppNamePrompt', 'Enter a globally unique name for the new web app.');
        }
        
        wizardContext.newSiteName = (await wizardContext.ui.showInputBox({
            prompt,
            placeHolder,
            validateInput: async (name: string): Promise<string | undefined> => await this.validateSiteName(client, name)
        })).trim();
        wizardContext.valuesToMask.push(wizardContext.newSiteName);

        const namingRules: IAzureNamingRules[] = [resourceGroupNamingRules];
        if (wizardContext.newSiteKind === AppKind.functionapp) {
            namingRules.push(storageAccountNamingRules);
        } else {
            namingRules.push(appServicePlanNamingRules);
        }

        namingRules.push(appInsightsNamingRules);
        wizardContext.relatedNameTask = this.generateRelatedName(wizardContext, wizardContext.newSiteName, namingRules);
    }

    public async getRelatedName(wizardContext: IAppServiceWizardContext, name: string): Promise<string | undefined> {
        return await this.generateRelatedName(wizardContext, name, appServicePlanNamingRules);
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.newSiteName;
    }

    protected async isRelatedNameAvailable(wizardContext: IAppServiceWizardContext, name: string): Promise<boolean> {
        const tasks: Promise<boolean>[] = [ResourceGroupListStep.isNameAvailable(wizardContext, name)];
        if (wizardContext.newSiteKind === AppKind.functionapp) {
            tasks.push(StorageAccountListStep.isNameAvailable(wizardContext, name));
        } else {
            tasks.push(AppServicePlanListStep.isNameAvailable(wizardContext, name, name));
        }

        return (await Promise.all(tasks)).every((v: boolean) => v);
    }

    private async validateSiteName(client: WebSiteManagementClient, name: string): Promise<string | undefined> {
        name = name.trim();

        if (name.length < siteNamingRules.minLength || name.length > siteNamingRules.maxLength) {
            return localize('invalidLength', 'The name must be between {0} and {1} characters.', siteNamingRules.minLength, siteNamingRules.maxLength);
        } else if (siteNamingRules.invalidCharsRegExp.test(name)) {
            return localize('invalidChars', "The name can only contain letters, numbers, or hyphens.");
        } else {
            const nameAvailability: WebSiteManagementModels.ResourceNameAvailability = await client.checkNameAvailability(name, 'Site');
            if (!nameAvailability.nameAvailable) {
                return nameAvailability.message;
            } else {
                return undefined;
            }
        }
    }
}
