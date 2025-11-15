/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ApplicationInsightsManagementClient } from '@azure/arm-appinsights';
import type { ResourceGroup } from '@azure/arm-resources';
import { AzExtLocation, LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { ActivityChildItem, ActivityChildType, activityErrorContext, activityFailContext, activityFailIcon, ActivityOutputType, AzureWizardExecuteStepWithActivityOutput, createContextValue, ExecuteActivityContext, ExecuteActivityOutput, nonNullProp, nonNullValueAndProp, parseError } from '@microsoft/vscode-azext-utils';
import { randomUUID } from 'crypto';
import { l10n, MessageItem, Progress, TreeItemCollapsibleState } from 'vscode';
import { ext } from '../extensionVariables';
import { createAppInsightsClient } from '../utils/azureClients';
import { AppInsightsListStep } from './AppInsightsListStep';
import { getAppInsightsSupportedLocation } from './getAppInsightsSupportedLocation';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsCreateStep extends AzureWizardExecuteStepWithActivityOutput<IAppServiceWizardContext & Partial<ExecuteActivityContext>> {
    public priority: number = 135;
    public stepName: string = 'AppInsightsCreateStep';
    private _skippedCreate: boolean = false;

    protected getOutputLogSuccess(context: IAppServiceWizardContext): string {
        let message: string = l10n.t('Successfully created application insights "{0}".', nonNullProp(context, 'newAppInsightsName'));
        if (this._skippedCreate) {
            message = l10n.t('Skipped creating application insights due to account restrictions or location compatibility.');
        }
        return message;
    }
    protected getOutputLogFail = (context: IAppServiceWizardContext) => l10n.t('Failed to create application insights "{0}"', nonNullProp(context, 'newAppInsightsName'));
    protected getTreeItemLabel(context: IAppServiceWizardContext): string {
        let message: string = l10n.t('Create application insights "{0}"', nonNullProp(context, 'newAppInsightsName'));
        if (this._skippedCreate) {
            message = l10n.t('Skipping application insights creation.');
        }

        return message;
    }

    private isMissingCreatePermissions: boolean = false;

    public async configureBeforeExecute(context: IAppServiceWizardContext): Promise<void> {
        const newAppInsightsName: string = nonNullProp(context, 'newAppInsightsName');
        const rgName: string = nonNullValueAndProp(context.resourceGroup, 'name');

        try {
            const client: ApplicationInsightsManagementClient = await createAppInsightsClient(context);
            context.appInsightsComponent = await client.components.get(rgName, newAppInsightsName);
            ext.outputChannel.appendLog(l10n.t('Found existing application insights "{0}".', newAppInsightsName));
            ext.outputChannel.appendLog(l10n.t('Using existing application insights "{0}".', newAppInsightsName));
        } catch (error) {
            // Don't throw error yet we might still be able to handle this condition in the following methods
        }
    }

    public async execute(context: IAppServiceWizardContext, _progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const verifyingAppInsightsAvailable: string = l10n.t('Verifying that Application Insights is available for this location...');
        ext.outputChannel.appendLog(verifyingAppInsightsAvailable);
        const resourceLocation: AzExtLocation = await LocationListStep.getLocation(context);
        const appInsightsLocation = await getAppInsightsSupportedLocation(context, resourceLocation);
        if (appInsightsLocation) {
            const client: ApplicationInsightsManagementClient = await createAppInsightsClient(context);
            const rg: ResourceGroup = nonNullProp(context, 'resourceGroup');
            const rgName: string = nonNullProp(rg, 'name');
            const aiName: string = nonNullProp(context, 'newAppInsightsName');

            try {
                context.appInsightsComponent = await client.components.createOrUpdate(
                    rgName,
                    aiName,
                    {
                        kind: 'web',
                        applicationType: 'web',
                        location: appInsightsLocation,
                        workspaceResourceId: context.logAnalyticsWorkspace?.id
                    });
            } catch (error) {
                const pError = parseError(error);
                if (pError.errorType === 'AuthorizationFailed') {
                    if (!context.advancedCreation) {
                        this._skippedCreate = true;
                        return;
                    }

                    this.isMissingCreatePermissions = true;
                    this.options.continueOnFail = true;
                    this.addExecuteSteps = () => [new AppInsightsNoCreatePermissionsStep()];
                    // Suppress generic output and replace with custom logs
                    this.options.suppressActivityOutput = ActivityOutputType.Message;
                    ext.outputChannel.appendLog(l10n.t('Unable to create application insights "{0}" in subscription "{1}" due to a lack of permissions.', aiName, context.subscriptionDisplayName));
                    ext.outputChannel.appendLog(pError.message);
                }
                throw error;
            }
        } else {
            this._skippedCreate = true;
        }
    }

    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return !context.appInsightsComponent && !!context.newAppInsightsName;
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
                label: l10n.t('Unable to create application insights "{0}" in subscription "{1}" due to a lack of permissions.', nonNullProp(context, 'newAppInsightsName'), context.subscriptionDisplayName),
            })];
        }

        return {
            item,
            message: this.getOutputLogFail(context),
        }
    }
}

class AppInsightsNoCreatePermissionsStep extends AzureWizardExecuteStepWithActivityOutput<IAppServiceWizardContext & Partial<ExecuteActivityContext>> {
    public priority: number = 136;
    public stepName: string = 'AppInsightsNoCreatePermissionsStep';

    protected getOutputLogSuccess = (context: IAppServiceWizardContext) => l10n.t('Successfully selected existing application insights "{0}"', nonNullValueAndProp(context.appInsightsComponent, 'name'));
    protected getOutputLogFail = () => l10n.t('Failed to select existing application insights');
    protected getTreeItemLabel = (context: IAppServiceWizardContext) => {
        return context.appInsightsComponent?.name ?
            l10n.t('Select application insights "{0}"', context.appInsightsComponent?.name) :
            l10n.t('Select application insights...');
    }

    public async execute(context: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number; }>): Promise<void> {
        progress.report({ message: l10n.t('Selecting application insights...') });

        const message: string = l10n.t('You do not have permission to create an application insights in subscription "{0}".', context.subscriptionDisplayName);
        const selectExisting: MessageItem = { title: l10n.t('Select Existing') };
        await context.ui.showWarningMessage(message, { modal: true, stepName: 'AspNoPermissions' }, selectExisting);

        context.telemetry.properties.forbiddenResponse = 'SelectExistingAppInsights';
        const step: AppInsightsListStep = new AppInsightsListStep(true /* suppressCreate */);
        await step.prompt(context);
    }

    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return !context.appInsightsComponent && !!context.newAppInsightsName;
    }
}
