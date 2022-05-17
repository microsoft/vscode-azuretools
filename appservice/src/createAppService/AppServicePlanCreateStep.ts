/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, WebSiteManagementClient } from '@azure/arm-appservice';
import { AzExtLocation, LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStep, nonNullProp, nonNullValue, parseError } from '@microsoft/vscode-azext-utils';
import { MessageItem, Progress } from 'vscode';
import { webProvider } from '../constants';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { tryGetAppServicePlan } from '../tryGetSiteResource';
import { createWebSiteClient } from '../utils/azureClients';
import { AppKind, WebsiteOS } from './AppKind';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { CustomLocation, IAppServiceWizardContext } from './IAppServiceWizardContext';

interface IAppServicePlan extends WebSiteManagementModels.AppServicePlan {
    properties: object;
}

export class AppServicePlanCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 120;

    public async execute(context: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const newPlanName: string = nonNullProp(context, 'newPlanName');
        const rgName: string = nonNullProp(nonNullValue(context.resourceGroup, 'name'), 'name');

        const findingAppServicePlan: string = localize('FindingAppServicePlan', 'Ensuring App Service plan "{0}" exists...', newPlanName);
        const creatingAppServicePlan: string = localize('CreatingAppServicePlan', 'Creating App Service plan "{0}"...', newPlanName);
        const foundAppServicePlan: string = localize('FoundAppServicePlan', 'Successfully found App Service plan "{0}".', newPlanName);
        const createdAppServicePlan: string = localize('CreatedAppServicePlan', 'Successfully created App Service plan "{0}".', newPlanName);
        ext.outputChannel.appendLog(findingAppServicePlan);

        try {
            const client: WebSiteManagementClient = await createWebSiteClient(context);
            const existingPlan: AppServicePlan | undefined = await tryGetAppServicePlan(client, rgName, newPlanName);

            if (existingPlan) {
                context.plan = existingPlan;
                ext.outputChannel.appendLog(foundAppServicePlan);
            } else {
                ext.outputChannel.appendLog(creatingAppServicePlan);
                progress.report({ message: creatingAppServicePlan });

                context.plan = await client.appServicePlans.beginCreateOrUpdateAndWait(rgName, newPlanName, await getNewPlan(context));
                ext.outputChannel.appendLog(createdAppServicePlan);
            }
        } catch (e) {
            if (parseError(e).errorType === 'AuthorizationFailed') {
                await this.selectExistingPrompt(context);
            } else {
                throw e;
            }
        }
    }

    public async selectExistingPrompt(context: IAppServiceWizardContext): Promise<void> {
        const message: string = localize('planForbidden', 'You do not have permission to create an app service plan in subscription "{0}".', context.subscriptionDisplayName);
        const selectExisting: MessageItem = { title: localize('selectExisting', 'Select Existing') };
        await context.ui.showWarningMessage(message, { modal: true, stepName: 'AspNoPermissions' }, selectExisting);

        context.telemetry.properties.forbiddenResponse = 'SelectExistingAsp';
        const step: AppServicePlanListStep = new AppServicePlanListStep(true /* suppressCreate */);
        await step.prompt(context);
    }

    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return !context.plan;
    }
}

async function getNewPlan(context: IAppServiceWizardContext): Promise<AppServicePlan> {
    const location: AzExtLocation = await LocationListStep.getLocation(context, webProvider);
    const plan: AppServicePlan = {
        kind: getPlanKind(context),
        sku: nonNullProp(context, 'newPlanSku'),
        location: location.name,
        reserved: context.newSiteOS === WebsiteOS.linux  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
    };

    const skuFamily = context.newPlanSku?.family ? context.newPlanSku?.family.toLowerCase() : '';
    if (skuFamily === 'ep' || skuFamily === 'ws') {
        plan.maximumElasticWorkerCount = 20;
    }

    if (context.customLocation) {
        addCustomLocationProperties(plan, context.customLocation);
    }

    return plan;
}

function addCustomLocationProperties(plan: AppServicePlan, customLocation: CustomLocation): void {
    plan.perSiteScaling = true;

    plan.kubeEnvironmentProfile = { id: customLocation.kubeEnvironment.id };
    plan.extendedLocation = { name: customLocation.id, type: 'customLocation' };
}

function getPlanKind(context: IAppServiceWizardContext): string {
    if (context.customLocation) {
        return 'linux,kubernetes';
    } else if (context.newSiteOS === WebsiteOS.linux) {
        return WebsiteOS.linux;
    } else {
        return AppKind.app;
    }
}
