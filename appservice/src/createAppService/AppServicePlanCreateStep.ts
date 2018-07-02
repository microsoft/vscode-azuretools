/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { SkuDescription } from 'azure-arm-website/lib/models';
import { ProgressLocation, window } from 'vscode';
import { AzureWizardExecuteStep } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { getAppServicePlanModelKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public async execute(wizardContext: IAppServiceWizardContext): Promise<IAppServiceWizardContext> {
        if (!wizardContext.plan) {
            // tslint:disable-next-line:no-non-null-assertion
            const newPlanName: string = wizardContext.newPlanName!;
            // tslint:disable-next-line:no-non-null-assertion
            const newSku: SkuDescription = wizardContext.newPlanSku!;
            const findingAppServicePlan: string = localize('FindingAppServicePlan', 'Ensuring App Service plan "{0}" with pricing tier "{1}" exists...', newPlanName, newSku.name);
            const foundAppServicePlan: string = localize('FoundAppServicePlan', 'Successfully found App Service plan "{0}".', newPlanName);
            await window.withProgress({ location: ProgressLocation.Notification, title: findingAppServicePlan}, async (): Promise<void> => {
                ext.outputChannel.appendLine(findingAppServicePlan);
                const websiteClient: WebSiteManagementClient = new WebSiteManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
                wizardContext.plan = await websiteClient.appServicePlans.createOrUpdate(wizardContext.resourceGroup.name, newPlanName, {
                    appServicePlanName: newPlanName,
                    kind: getAppServicePlanModelKind(wizardContext.newSiteKind, wizardContext.newSiteOS),
                    sku: newSku,
                    location: wizardContext.location.name,
                    reserved: wizardContext.newSiteOS === WebsiteOS.linux  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
                });
                window.showInformationMessage(foundAppServicePlan);
                ext.outputChannel.appendLine(foundAppServicePlan);
            });
        }

        return wizardContext;
    }
}
