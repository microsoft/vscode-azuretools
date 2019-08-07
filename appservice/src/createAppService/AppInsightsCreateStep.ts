/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsManagementClient } from 'azure-arm-appinsights';
import { ResourceManagementClient } from 'azure-arm-resource';
import { Provider, ProviderResourceType } from 'azure-arm-resource/lib/resource/models';
import { Location } from 'azure-arm-resource/lib/subscription/models';
import { Progress } from 'vscode';
import { AzureWizardExecuteStep, createAzureClient, IParsedError, parseError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp, nonNullValue } from '../utils/nonNull';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 135;

    public async execute(wizardContext: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const location: Location = nonNullProp(wizardContext, 'location');
        const verifyingAppInsightsAvailable: string = localize('verifyingAppInsightsAvailable', 'Verifying that application insights is available for this location...');
        ext.outputChannel.appendLine(verifyingAppInsightsAvailable);
        if (await this.appInsightsSupportedInLocation(wizardContext, location)) {
            const client: ApplicationInsightsManagementClient = createAzureClient(wizardContext, ApplicationInsightsManagementClient);
            const rgName: string = nonNullValue(wizardContext.newResourceGroupName);
            const aiName: string = nonNullValue(wizardContext.newAppInsightsName);
            try {
                wizardContext.appInsightsComponent = await client.components.get(rgName, aiName);
                ext.outputChannel.appendLine(localize('existingNewAppInsights', 'Using existing application insights component "{0}".', aiName));
            } catch (error) {
                const pError: IParsedError = parseError(error);
                // Only expecting a resource not found error if this is a new component
                if (pError.errorType === 'ResourceNotFound') {
                    const creatingNewAppInsights: string = localize('creatingNewAppInsightsInsights', 'Creating new application insights component "{0}"...', wizardContext.newSiteName);
                    ext.outputChannel.appendLine(creatingNewAppInsights);
                    progress.report({ message: creatingNewAppInsights });

                    wizardContext.appInsightsComponent = await client.components.createOrUpdate(rgName, aiName, { kind: 'web', applicationType: 'web', location: nonNullProp(location, 'name') });
                    const createdNewAppInsights: string = localize('createdNewAppInsights', 'Created new application insights component "{0}"...', aiName);
                    ext.outputChannel.appendLine(createdNewAppInsights);
                } else {
                    throw error;
                }
            }
        } else {
            const appInsightsNotAvailable: string = localize('appInsightsNotAvailable', 'Skipping creating an application insights component because it isn\'t compatible with this location.');
            ext.outputChannel.appendLine(appInsightsNotAvailable);
        }
    }

    public shouldExecute(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.appInsightsComponent;
    }

    private async appInsightsSupportedInLocation(wizardContext: IAppServiceWizardContext, location: Location): Promise<boolean> {
        const resourceClient: ResourceManagementClient = createAzureClient(wizardContext, ResourceManagementClient);
        const supportedRegions: Provider = await resourceClient.providers.get('microsoft.insights');
        const componentsResourceType: ProviderResourceType | undefined = supportedRegions.resourceTypes && supportedRegions.resourceTypes.find(aiRt => aiRt.resourceType === 'components');

        return !!componentsResourceType && !!componentsResourceType.locations && componentsResourceType.locations.some((loc) => loc === location.displayName);
    }
}
