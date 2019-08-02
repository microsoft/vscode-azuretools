/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsManagementClient } from 'azure-arm-appinsights';
import { Location } from 'azure-arm-resource/lib/subscription/models';
import { AzureWizardExecuteStep, createAzureClient } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp, nonNullValue } from '../utils/nonNull';
import { requestUtils } from '../utils/requestUtils';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 500;

    public async execute(wizardContext: IAppServiceWizardContext): Promise<void> {
        const location: Location = nonNullProp(wizardContext, 'location');
        const verifyingAppInsightsAvailable: string = localize('verifyingAppInsightsAvailable', 'Verifying that application insights is available for this location...');
        ext.outputChannel.appendLine(verifyingAppInsightsAvailable);
        if (await this.appInsightsSupportedInLocation(wizardContext, location)) {

            const creatingNewAppInsights: string = localize('creatingNewAppInsightsInsights', 'Creating new application insights component "{0}"...', wizardContext.newSiteName);
            ext.outputChannel.appendLine(creatingNewAppInsights);

            const client: ApplicationInsightsManagementClient = createAzureClient(wizardContext, ApplicationInsightsManagementClient);
            wizardContext.applicationInsights = await client.components.createOrUpdate(
                nonNullValue(wizardContext.newResourceGroupName),
                nonNullValue(wizardContext.newSiteName),
                { kind: 'web', applicationType: 'web', location: nonNullProp(location, 'name') });
        } else {
            const appInsightsNotAvailable: string = localize('appInsightsNotAvailable', 'Skipping creating an application insights component because it isn\'t compatible with this location.');
            ext.outputChannel.appendLine(appInsightsNotAvailable);
        }
    }

    public shouldExecute(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.applicationInsights;
    }

    private async appInsightsSupportedInLocation(wizardContext: IAppServiceWizardContext, location: Location): Promise<boolean> {
        const aiRegionMappingUrl: string = 'providers/microsoft.insights?api-version=2014-04-01-preview';
        const aiRegionRequest: requestUtils.Request = await requestUtils.getDefaultAzureRequest(aiRegionMappingUrl, wizardContext);
        const aiRegionMap: ApplicationInsightsJsonResponse = <ApplicationInsightsJsonResponse>JSON.parse((await requestUtils.sendRequest(aiRegionRequest)));
        const aiComponents: ApplicationInsightsResourceType | undefined = aiRegionMap.resourceTypes.find((aiRt) => aiRt.resourceType === 'components');

        return aiComponents ? aiComponents.locations.some((loc) => loc === location.displayName) : false;
    }
}

type ApplicationInsightsJsonResponse = {
    namespace: string,
    resourceTypes: ApplicationInsightsResourceType[]
};

type ApplicationInsightsResourceType = {
    resourceType: string,
    locations: string[],
    apiVersions: string[]
};
