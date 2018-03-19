/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { ResourceNameAvailability } from 'azure-arm-website/lib/models';
import { AzureNameStep, IAzureNamingRules, IAzureUserInput, resourceGroupNamingRules, ResourceGroupStep, storageAccountNamingRules, StorageAccountStep } from 'vscode-azureextensionui';
import { AppKind, getAppKindDisplayName } from './AppKind';
import { appServicePlanNamingRules, AppServicePlanStep } from './AppServicePlanStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class SiteNameStep extends AzureNameStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {
        const client: WebSiteManagementClient = new WebSiteManagementClient(wizardContext.credentials, wizardContext.subscription.subscriptionId);
        wizardContext.siteName = (await ui.showInputBox({
            prompt: `Enter a globally unique name for the new ${getAppKindDisplayName(wizardContext.appKind)}.`,
            validateInput: async (value: string): Promise<string | undefined> => {
                value = value ? value.trim() : '';
                const nameAvailability: ResourceNameAvailability = await client.checkNameAvailability(value, 'site');
                if (!nameAvailability.nameAvailable) {
                    return nameAvailability.message;
                } else {
                    return undefined;
                }
            }
        })).trim();

        const namingRules: IAzureNamingRules[] = [resourceGroupNamingRules];
        if (wizardContext.appKind === AppKind.functionapp) {
            namingRules.push(storageAccountNamingRules);
        } else {
            namingRules.push(appServicePlanNamingRules);
        }
        wizardContext.relatedNameTask = this.generateRelatedName(wizardContext, wizardContext.siteName, namingRules);

        return wizardContext;
    }

    public async execute(wizardContext: IAppServiceWizardContext): Promise<IAppServiceWizardContext> {
        return wizardContext;
    }

    protected async isNameAvailable(wizardContext: IAppServiceWizardContext, name: string): Promise<boolean> {
        const tasks: Promise<boolean>[] = [ResourceGroupStep.isNameAvailable(wizardContext, name)];
        if (wizardContext.appKind === AppKind.functionapp) {
            tasks.push(StorageAccountStep.isNameAvailable(wizardContext, name));
        } else {
            tasks.push(AppServicePlanStep.isNameAvailable(wizardContext, name, name));
        }

        return (await Promise.all(tasks)).every((v: boolean) => v);
    }
}
