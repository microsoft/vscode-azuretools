/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from '@azure/arm-appservice';
import { MessageItem, Progress } from 'vscode';
import { AzureWizardExecuteStep, parseError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { tryGetAppServicePlan } from '../tryGetSiteResource';
import { createWebSiteClient } from '../utils/azureClients';
import { nonNullProp, nonNullValueAndProp } from '../utils/nonNull';
import { getAppServicePlanModelKind, WebsiteOS } from './AppKind';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 120;

    public async execute(wizardContext: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const newPlanName: string = nonNullProp(wizardContext, 'newPlanName');
        const rgName: string = nonNullValueAndProp(wizardContext.resourceGroup, 'name');

        const findingAppServicePlan: string = localize('FindingAppServicePlan', 'Ensuring App Service plan "{0}" exists...', newPlanName);
        const creatingAppServicePlan: string = localize('CreatingAppServicePlan', 'Creating App Service plan "{0}"...', newPlanName);
        const foundAppServicePlan: string = localize('FoundAppServicePlan', 'Successfully found App Service plan "{0}".', newPlanName);
        const createdAppServicePlan: string = localize('CreatedAppServicePlan', 'Successfully created App Service plan "{0}".', newPlanName);
        ext.outputChannel.appendLog(findingAppServicePlan);

        try {
            const client: WebSiteManagementClient = await createWebSiteClient(wizardContext);
            const existingPlan: WebSiteManagementModels.AppServicePlan | undefined = await tryGetAppServicePlan(client, rgName, newPlanName);

            if (existingPlan) {
                wizardContext.plan = existingPlan;
                ext.outputChannel.appendLog(foundAppServicePlan);
            } else {
                ext.outputChannel.appendLog(creatingAppServicePlan);
                progress.report({ message: creatingAppServicePlan });
                const isElasticPremium: boolean = wizardContext.newPlanSku?.family?.toLowerCase() === 'ep';
                wizardContext.plan = await client.appServicePlans.createOrUpdate(rgName, newPlanName, {
                    kind: getAppServicePlanModelKind(wizardContext.newSiteKind, nonNullProp(wizardContext, 'newSiteOS')),
                    sku: nonNullProp(wizardContext, 'newPlanSku'),
                    location: nonNullValueAndProp(wizardContext.location, 'name'),
                    reserved: wizardContext.newSiteOS === WebsiteOS.linux,  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
                    maximumElasticWorkerCount: isElasticPremium ? 20 : undefined
                });
                ext.outputChannel.appendLog(createdAppServicePlan);
            }
        } catch (e) {
            if (parseError(e).errorType === 'AuthorizationFailed') {
                await this.selectExistingPrompt(wizardContext);
            } else {
                throw e;
            }
        }

    }

    public async selectExistingPrompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        const message: string = localize('rgForbidden', 'You do not have permission to create a app service plan in subscription "{0}".', wizardContext.subscriptionDisplayName);
        const selectExisting: MessageItem = { title: localize('selectExisting', 'Select Existing') };
        wizardContext.telemetry.properties.cancelStep = 'AspNoPermissions';
        await wizardContext.ui.showWarningMessage(message, { modal: true }, selectExisting);

        wizardContext.telemetry.properties.cancelStep = undefined;
        wizardContext.telemetry.properties.forbiddenResponse = 'SelectExistingAsp';
        const step: AppServicePlanListStep = new AppServicePlanListStep(true /* suppressCreate */);
        await step.prompt(wizardContext);
    }

    public shouldExecute(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.plan;
    }
}
