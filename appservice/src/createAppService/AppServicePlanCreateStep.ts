/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, WebSiteManagementClient } from '@azure/arm-appservice';
import { AzExtLocation, LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStepWithActivityOutput, ExecuteActivityContext, nonNullProp, nonNullValue, parseError } from '@microsoft/vscode-azext-utils';
import { l10n, MessageItem, Progress } from 'vscode';
import { webProvider } from '../constants';
import { tryGetAppServicePlan } from '../tryGetSiteResource';
import { createWebSiteClient } from '../utils/azureClients';
import { AppKind, WebsiteOS } from './AppKind';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { CustomLocation, IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanCreateStep extends AzureWizardExecuteStepWithActivityOutput<IAppServiceWizardContext & Partial<ExecuteActivityContext>> {
    public priority: number = 120;
    public stepName = 'AppServicePlanCreateStep';
    private _usedExistingPlan: boolean = false;

    protected getTreeItemLabel(context: IAppServiceWizardContext): string {
        const newPlanName: string = nonNullProp(context, 'newPlanName');
        return this._usedExistingPlan ?
            l10n.t('Using existing app service plan "{0}"', newPlanName) :
            l10n.t('Create app service plan "{0}"', newPlanName);
    }
    protected getOutputLogSuccess(context: IAppServiceWizardContext): string {
        const newPlanName: string = nonNullProp(context, 'newPlanName');
        return this._usedExistingPlan ?
            l10n.t('Successfully found existing app service plan "{0}".', newPlanName) :
            l10n.t('Successfully created app service plan "{0}".', newPlanName);
    }
    protected getOutputLogFail(context: IAppServiceWizardContext): string {
        const newPlanName: string = nonNullProp(context, 'newPlanName');
        return l10n.t('Failed to create app service plan "{0}".', newPlanName);
    }
    protected getOutputLogProgress(context: IAppServiceWizardContext): string {
        const newPlanName: string = nonNullProp(context, 'newPlanName');
        return l10n.t('Creating app service plan "{0}"...', newPlanName);
    }

    public async execute(context: IAppServiceWizardContext, _progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const newPlanName: string = nonNullProp(context, 'newPlanName');
        const rgName: string = nonNullProp(nonNullValue(context.resourceGroup, 'name'), 'name');


        try {
            const client: WebSiteManagementClient = await createWebSiteClient(context);
            const existingPlan: AppServicePlan | undefined = await tryGetAppServicePlan(client, rgName, newPlanName);

            if (existingPlan) {
                context.plan = existingPlan;
            } else {

                context.plan = await client.appServicePlans.beginCreateOrUpdateAndWait(rgName, newPlanName, await getNewPlan(context));
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
        const message: string = l10n.t('You do not have permission to create an app service plan in subscription "{0}".', context.subscriptionDisplayName);
        const selectExisting: MessageItem = { title: l10n.t('Select Existing') };
        await context.ui.showWarningMessage(message, { modal: true, stepName: 'AspNoPermissions' }, selectExisting);

        context.telemetry.properties.forbiddenResponse = 'SelectExistingAsp';
        const step: AppServicePlanListStep = new AppServicePlanListStep(true /* suppressCreate */);
        await step.prompt(context);
        this._usedExistingPlan = true;
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
        reserved: context.newSiteOS === WebsiteOS.linux,  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
        zoneRedundant: context.zoneRedundant,
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
