/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ApplicationInsightsManagementClient } from '@azure/arm-appinsights';
import type { ResourceGroup } from '@azure/arm-resources';
import { AzExtLocation, LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStep, IParsedError, nonNullProp, parseError } from '@microsoft/vscode-azext-utils';
import { l10n, MessageItem, Progress } from 'vscode';
import { ext } from '../extensionVariables';
import { createAppInsightsClient } from '../utils/azureClients';
import { AppInsightsListStep } from './AppInsightsListStep';
import { getAppInsightsSupportedLocation } from './getAppInsightsSupportedLocation';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 135;

    public async execute(context: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
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
                ext.outputChannel.appendLog(l10n.t('Using existing Application Insights resource "{0}".', aiName));
            } catch (error) {
                const pError: IParsedError = parseError(error);
                // Only expecting a resource not found error if this is a new component
                if (pError.errorType === 'ResourceNotFound') {
                    const creatingNewAppInsights: string = l10n.t('Creating Application Insights resource "{0}"...', aiName);
                    ext.outputChannel.appendLog(creatingNewAppInsights);
                    progress.report({ message: creatingNewAppInsights });

                    context.appInsightsComponent = await client.components.createOrUpdate(
                        rgName,
                        aiName,
                        {
                            kind: 'web',
                            applicationType: 'web',
                            location: appInsightsLocation,
                            workspaceResourceId: context.logAnalyticsWorkspace?.id
                        });
                    const createdNewAppInsights: string = l10n.t('Successfully created Application Insights resource "{0}".', aiName);
                    ext.outputChannel.appendLog(createdNewAppInsights);
                } else if (pError.errorType === 'AuthorizationFailed') {
                    if (!context.advancedCreation) {
                        const appInsightsNotAuthorized: string = l10n.t('Skipping Application Insights resource because you do not have permission to create one in this subscription.');
                        ext.outputChannel.appendLog(appInsightsNotAuthorized);
                    } else {
                        await this.selectExistingPrompt(context);
                    }
                } else {
                    throw error;
                }
            }
        } else {
            const appInsightsNotAvailable: string = l10n.t('Skipping Application Insights resource because it isn\'t compatible with this location.');
            ext.outputChannel.appendLog(appInsightsNotAvailable);
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
            context.telemetry.properties.forbiddenResponse = 'SkipAppInsights';
        } else {
            context.telemetry.properties.forbiddenResponse = 'SelectExistingAppInsights';
            const step: AppInsightsListStep = new AppInsightsListStep(true /* suppressCreate */);
            await step.prompt(context);
        }
    }


    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return !context.appInsightsComponent && !!context.newAppInsightsName;
    }
}
