/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ApplicationInsightsManagementClient } from '@azure/arm-appinsights';
import type { ResourceGroup } from '@azure/arm-resources';
import { AzExtLocation, LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStepWithActivityOutput, ExecuteActivityContext, IParsedError, nonNullProp, parseError } from '@microsoft/vscode-azext-utils';
import { l10n, MessageItem, Progress } from 'vscode';
import { ext } from '../extensionVariables';
import { createAppInsightsClient } from '../utils/azureClients';
import { AppInsightsListStep } from './AppInsightsListStep';
import { getAppInsightsSupportedLocation } from './getAppInsightsSupportedLocation';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsCreateStep extends AzureWizardExecuteStepWithActivityOutput<IAppServiceWizardContext & Partial<ExecuteActivityContext>> {
    public priority: number = 135;
    public stepName: string = 'AppInsightsCreateStep';
    private _usedExistingAppInsights: boolean = false;
    private _skippedCreate: boolean = false;

    protected getTreeItemLabel(context: IAppServiceWizardContext): string {
        const aiName: string = nonNullProp(context, 'newAppInsightsName');
        let message: string = l10n.t('Create application insights "{0}"', aiName);
        if (this._skippedCreate) {
            message = l10n.t('Skipping application insights creation.');
        } else if (this._usedExistingAppInsights) {
            message = l10n.t('Using existing application insights "{0}"', aiName);
        }
        return message;
    }
    protected getOutputLogSuccess(context: IAppServiceWizardContext): string {
        const aiName: string = nonNullProp(context, 'newAppInsightsName');
        let message: string = l10n.t('Successfully created application insights "{0}".', aiName);
        if (this._skippedCreate) {
            message = l10n.t('Skipped creating application insights due to account restrictions or location compatibility.');
        } else if (this._usedExistingAppInsights) {
            message = l10n.t('Successfully found existing application insights "{0}".', aiName);
        }
        return message;
    }
    protected getOutputLogFail(context: IAppServiceWizardContext): string {
        const aiName: string = nonNullProp(context, 'newAppInsightsName');
        return l10n.t('Failed to create application insights "{0}".', aiName);
    }
    protected getOutputLogProgress(context: IAppServiceWizardContext): string {
        const aiName: string = nonNullProp(context, 'newAppInsightsName');
        return l10n.t('Creating application insights "{0}"...', aiName);
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
                context.appInsightsComponent = await client.components.get(rgName, aiName);
                this._usedExistingAppInsights = true;
            } catch (error) {
                const pError: IParsedError = parseError(error);
                // Only expecting a resource not found error if this is a new component
                if (pError.errorType === 'ResourceNotFound') {

                    context.appInsightsComponent = await client.components.createOrUpdate(
                        rgName,
                        aiName,
                        {
                            kind: 'web',
                            applicationType: 'web',
                            location: appInsightsLocation,
                            workspaceResourceId: context.logAnalyticsWorkspace?.id
                        });
                } else if (pError.errorType === 'AuthorizationFailed') {
                    if (!context.advancedCreation) {
                        this._skippedCreate = true;
                    } else {
                        await this.selectExistingPrompt(context);
                        this._usedExistingAppInsights = true;
                    }
                } else {
                    throw error;
                }
            }
        } else {
            this._skippedCreate = true;
        }
    }

    public async selectExistingPrompt(context: IAppServiceWizardContext): Promise<void> {
        const message: string = l10n.t('You do not have permission to create an app insights resource in subscription "{0}".', context.subscriptionDisplayName);
        const selectExisting: MessageItem = { title: l10n.t('Select Existing') };
        const skipForNow: MessageItem = { title: l10n.t('Skip for Now') };
        const result = await context.ui.showWarningMessage(message, { modal: true, stepName: 'AppInsightsNoPermissions' }, selectExisting, skipForNow);
        if (result === skipForNow) {
            context.telemetry.properties.aiSkipForNow = 'true';
            context.appInsightsSkip = true;
            this._skippedCreate = true;
            context.telemetry.properties.forbiddenResponse = 'SkipAppInsights';
        } else {
            context.telemetry.properties.forbiddenResponse = 'SelectExistingAppInsights';
            const step: AppInsightsListStep = new AppInsightsListStep(true /* suppressCreate */);
            await step.prompt(context);
            this._usedExistingAppInsights = true;
        }
    }


    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return !context.appInsightsComponent && !!context.newAppInsightsName;
    }
}
