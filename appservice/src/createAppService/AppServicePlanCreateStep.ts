/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, WebSiteManagementClient } from '@azure/arm-appservice';
import { AzExtLocation, LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { ActivityChildItem, ActivityChildType, activityErrorContext, activityFailContext, activityFailIcon, ActivityOutputType, AzureWizardExecuteStepWithActivityOutput, createContextValue, ExecuteActivityContext, ExecuteActivityOutput, nonNullProp, nonNullValue, nonNullValueAndProp, parseError } from '@microsoft/vscode-azext-utils';
import { randomUUID } from 'crypto';
import { l10n, MessageItem, Progress, TreeItemCollapsibleState } from 'vscode';
import { webProvider } from '../constants';
import { ext } from '../extensionVariables';
import { tryGetAppServicePlan } from '../tryGetSiteResource';
import { createWebSiteClient } from '../utils/azureClients';
import { AppKind, WebsiteOS } from './AppKind';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { CustomLocation, IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanCreateStep extends AzureWizardExecuteStepWithActivityOutput<IAppServiceWizardContext & Partial<ExecuteActivityContext>> {
    public priority: number = 120;
    public stepName = 'AppServicePlanCreateStep';
    private isMissingCreatePermissions: boolean = false;

    protected getOutputLogSuccess = (context: IAppServiceWizardContext) => l10n.t('Successfully created app service plan "{0}".', nonNullProp(context, 'newPlanName'));
    protected getOutputLogFail = (context: IAppServiceWizardContext) => l10n.t('Failed to create app service plan "{0}"', nonNullProp(context, 'newPlanName'));
    protected getTreeItemLabel = (context: IAppServiceWizardContext) => l10n.t('Create app service plan "{0}"', nonNullProp(context, 'newPlanName'));

    public async configureBeforeExecute(context: IAppServiceWizardContext & Partial<ExecuteActivityContext>): Promise<void> {
        const newPlanName: string = nonNullProp(context, 'newPlanName');
        const rgName: string = nonNullProp(nonNullValue(context.resourceGroup, 'name'), 'name');

        try {
            const client: WebSiteManagementClient = await createWebSiteClient(context);
            const existingPlan: AppServicePlan | undefined = await tryGetAppServicePlan(client, rgName, newPlanName);

            if (existingPlan) {
                context.plan = existingPlan;
                ext.outputChannel.appendLog(l10n.t('Found existing app service plan "{0}".', newPlanName));
                ext.outputChannel.appendLog(l10n.t('Using existing app service plan "{0}".', newPlanName));
            }
        } catch (error) {
            // Don't throw error yet we might still be able to handle this condition in the following methods
        }
    }

    public async execute(context: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        progress.report({ message: l10n.t('Creating app service plan') });

        const newPlanName: string = nonNullProp(context, 'newPlanName');
        const rgName: string = nonNullValueAndProp(context.resourceGroup, 'name');

        try {
            const client: WebSiteManagementClient = await createWebSiteClient(context);
            context.plan = await client.appServicePlans.beginCreateOrUpdateAndWait(rgName, newPlanName, await getNewPlan(context));
        } catch (e) {
            const pError = parseError(e);
            if (pError.errorType === 'AuthorizationFailed') {
                this.isMissingCreatePermissions = true;
                this.options.continueOnFail = true;
                this.addExecuteSteps = () => [new AppServicePlanNoCreatePermissionsStep()];
                // Suppress generic output and replace with custom logs
                this.options.suppressActivityOutput = ActivityOutputType.Message;
                ext.outputChannel.appendLog(l10n.t('Unable to create app service plan "{0}" in subscription "{1}" due to a lack of permissions.', newPlanName, context.subscriptionDisplayName));
                ext.outputChannel.appendLog(pError.message);
            }
            throw e;
        }
    }

    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return !context.plan;
    }

    private _errorItemId: string = randomUUID();

    public override createFailOutput(context: IAppServiceWizardContext & Partial<ExecuteActivityContext>): ExecuteActivityOutput {
        const item: ActivityChildItem = new ActivityChildItem({
            label: this.getTreeItemLabel(context),
            activityType: ActivityChildType.Fail,
            contextValue: createContextValue([this.stepName, activityFailContext]),
            iconPath: activityFailIcon,
            isParent: true,
            initialCollapsibleState: TreeItemCollapsibleState.Expanded,
        });

        if (this.isMissingCreatePermissions) {
            item.getChildren = () => [new ActivityChildItem({
                id: this._errorItemId,
                activityType: ActivityChildType.Error,
                contextValue: createContextValue([`${this.stepName}Item`, activityErrorContext]),
                label: l10n.t('Unable to create app service plan "{0}" in subscription "{1}" due to a lack of permissions.', nonNullProp(context, 'newPlanName'), context.subscriptionDisplayName),
            })];
        }

        return {
            item,
            message: this.getOutputLogFail(context),
        }
    }
}

class AppServicePlanNoCreatePermissionsStep extends AzureWizardExecuteStepWithActivityOutput<IAppServiceWizardContext & Partial<ExecuteActivityContext>> {
    public priority: number = 121;
    public stepName: string = 'appserviceplanNoCreatePermissionsSelectStep';
    protected getOutputLogSuccess = (context: IAppServiceWizardContext) => l10n.t('Successfully selected existing app service plan "{0}"', nonNullValueAndProp(context.plan, 'name'));
    protected getOutputLogFail = () => l10n.t('Failed to select an existing app service plan.');
    protected getTreeItemLabel = (context: IAppServiceWizardContext) => {
        return context.plan?.name ?
            l10n.t('Select app service plan "{0}"', context.plan?.name) :
            l10n.t('Select app service plan');
    }

    public async execute(context: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number; }>): Promise<void> {
        progress.report({ message: l10n.t('Selecting app service plan...') });

        const message: string = l10n.t('You do not have permission to create an app service plan in subscription "{0}".', context.subscriptionDisplayName);
        const selectExisting: MessageItem = { title: l10n.t('Select Existing') };
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
