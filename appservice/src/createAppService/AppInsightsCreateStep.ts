/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsManagementClient } from 'azure-arm-appinsights';
import { ResourceManagementClient } from 'azure-arm-resource';
import { Provider, ProviderResourceType } from 'azure-arm-resource/lib/resource/models';
import { Location } from 'azure-arm-resource/lib/subscription/models';
import { Progress } from 'vscode';
import { AzureWizardExecuteStep, createAzureClient, IParsedError, LocationListStep, parseError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp, nonNullValue } from '../utils/nonNull';
import { requestUtils } from '../utils/requestUtils';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 135;
    private _location: string;

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

                    wizardContext.appInsightsComponent = await client.components.createOrUpdate(rgName, aiName, { kind: 'web', applicationType: 'web', location: this._location });
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

    public async appInsightsSupportedInLocation(wizardContext: IAppServiceWizardContext, location: Location): Promise<boolean> {
        const resourceClient: ResourceManagementClient = createAzureClient(wizardContext, ResourceManagementClient);
        const supportedRegions: Provider = await resourceClient.providers.get('microsoft.insights');
        const componentsResourceType: ProviderResourceType | undefined = supportedRegions.resourceTypes && supportedRegions.resourceTypes.find(aiRt => aiRt.resourceType === 'components');

        if (!!componentsResourceType && !!componentsResourceType.locations && componentsResourceType.locations.some((loc) => loc === location.displayName)) {
            this._location = nonNullProp(location, 'name');
            return true;
        } else {
            // If there is no exact match, then query the regionMapping.json
            const request: requestUtils.Request = await requestUtils.getDefaultRequest('https://appinsights.azureedge.net/portal/regionMapping.json');
            const response: string = await requestUtils.sendRequest(request);
            const regionMappingJson: RegionMappingJsonResponse = <RegionMappingJsonResponse>JSON.parse(response);
            const locationName: string = nonNullProp(location, 'name');
            // tslint:disable-next-line: strict-boolean-expressions
            if (regionMappingJson.regions[locationName]) {
                // Find the entry for the desired location and go through pairedRegions in order until finding a location that is supported for that subscription
                for (const region of regionMappingJson.regions[locationName].pairedRegions) {
                    const availableLocations: Location[] = await LocationListStep.getLocations(wizardContext);
                    if (availableLocations.some((loc) => loc.name === region)) {
                        this._location = region;
                        return true;
                    }
                }
            }
            return false;
        }
    }
}

type RegionMappingJsonResponse = {
    regions: {
        [key: string]: RegionMap
    }
};

type RegionMap = {
    geo: string,
    pairedRegions: string[]
};
