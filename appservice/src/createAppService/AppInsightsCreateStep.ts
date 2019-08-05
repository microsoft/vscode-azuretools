/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsManagementClient } from 'azure-arm-appinsights';
import { ResourceManagementClient } from 'azure-arm-resource';
import { Provider, ProviderResourceType } from 'azure-arm-resource/lib/resource/models';
import { Location } from 'azure-arm-resource/lib/subscription/models';
import { Progress } from 'vscode';
import { AzureWizardExecuteStep, createAzureClient } from 'vscode-azureextensionui';
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

            const creatingNewAppInsights: string = localize('creatingNewAppInsightsInsights', 'Creating new application insights component "{0}"...', wizardContext.newSiteName);
            ext.outputChannel.appendLine(creatingNewAppInsights);
            progress.report({ message: creatingNewAppInsights });

            const client: ApplicationInsightsManagementClient = createAzureClient(wizardContext, ApplicationInsightsManagementClient);
            wizardContext.applicationInsights = await client.components.createOrUpdate(
                nonNullValue(wizardContext.newResourceGroupName),
                nonNullValue(wizardContext.newApplicationInsightsName),
                { kind: 'web', applicationType: 'web', location: nonNullProp(location, 'name') });
            const createdNewAppInsights: string = localize('createdNewAppInsights', 'Created new application insights component "{0}"...', wizardContext.newSiteName);
            wizardContext.aiInstrumentationKey = wizardContext.applicationInsights.instrumentationKey;
            ext.outputChannel.appendLine(createdNewAppInsights);
        } else {
            const appInsightsNotAvailable: string = localize('appInsightsNotAvailable', 'Skipping creating an application insights component because it isn\'t compatible with this location.');
            ext.outputChannel.appendLine(appInsightsNotAvailable);
        }
    }

    public shouldExecute(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.applicationInsights;
    }

    private async appInsightsSupportedInLocation(wizardContext: IAppServiceWizardContext, location: Location): Promise<boolean> {
        const resourceClient: ResourceManagementClient = createAzureClient(wizardContext, ResourceManagementClient);
        const insightsRegionMap: Provider = await resourceClient.providers.get('microsoft.insights');
        const componentsResourceType: ProviderResourceType | undefined = insightsRegionMap.resourceTypes ? insightsRegionMap.resourceTypes.find((aiRt) => aiRt.resourceType === 'components') : undefined;

        return componentsResourceType ?
            componentsResourceType.locations ?
                componentsResourceType.locations.some((loc) => loc === location.displayName) : false
            : false;
    }
}
