/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsManagementClient } from '@azure/arm-appinsights';
import { ResourceManagementClient, ResourceManagementModels } from '@azure/arm-resources';
import { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import { Progress } from 'vscode';
import { AzExtLocation, AzureWizardExecuteStep, createGenericClient, IParsedError, LocationListStep, parseError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { createAppInsightsClient, createResourceClient } from '../utils/azureClients';
import { areLocationNamesEqual } from '../utils/azureUtils';
import { nonNullProp } from '../utils/nonNull';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 135;

    public async execute(wizardContext: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const resourceLocation: AzExtLocation = await LocationListStep.getLocation(wizardContext);
        const verifyingAppInsightsAvailable: string = localize('verifyingAppInsightsAvailable', 'Verifying that Application Insights is available for this location...');
        ext.outputChannel.appendLog(verifyingAppInsightsAvailable);
        const appInsightsLocation: string | undefined = await this.getSupportedLocation(wizardContext, resourceLocation);

        if (appInsightsLocation) {
            const client: ApplicationInsightsManagementClient = await createAppInsightsClient(wizardContext);
            const rg: ResourceManagementModels.ResourceGroup = nonNullProp(wizardContext, 'resourceGroup');
            const rgName: string = nonNullProp(rg, 'name');
            const aiName: string = nonNullProp(wizardContext, 'newAppInsightsName');

            try {
                wizardContext.appInsightsComponent = await client.components.get(rgName, aiName);
                ext.outputChannel.appendLog(localize('existingNewAppInsights', 'Using existing Application Insights resource "{0}".', aiName));
            } catch (error) {
                const pError: IParsedError = parseError(error);
                // Only expecting a resource not found error if this is a new component
                if (pError.errorType === 'ResourceNotFound') {
                    const creatingNewAppInsights: string = localize('creatingNewAppInsightsInsights', 'Creating Application Insights resource "{0}"...', aiName);
                    ext.outputChannel.appendLog(creatingNewAppInsights);
                    progress.report({ message: creatingNewAppInsights });

                    wizardContext.appInsightsComponent = await client.components.createOrUpdate(rgName, aiName, { kind: 'web', applicationType: 'web', location: appInsightsLocation });
                    const createdNewAppInsights: string = localize('createdNewAppInsights', 'Successfully created Application Insights resource "{0}".', aiName);
                    ext.outputChannel.appendLog(createdNewAppInsights);
                } else {
                    throw error;
                }
            }
        } else {
            const appInsightsNotAvailable: string = localize('appInsightsNotAvailable', 'Skipping creating an Application Insights resource because it isn\'t compatible with this location.');
            ext.outputChannel.appendLog(appInsightsNotAvailable);
        }
    }

    public shouldExecute(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.appInsightsComponent && !!wizardContext.newAppInsightsName;
    }

    // returns the supported location, a location in the region map, or undefined
    private async getSupportedLocation(wizardContext: IAppServiceWizardContext, location: AzExtLocation): Promise<string | undefined> {
        const locations: string[] = await this.getLocations(wizardContext) || [];
        const locationName: string = nonNullProp(location, 'name');

        if (locations.some((loc) => areLocationNamesEqual(loc, location.name))) {
            wizardContext.telemetry.properties.aiLocationSupported = 'true';
            return locationName;
        } else {
            // If there is no exact match, then query the regionMapping.json
            const pairedRegions: string[] | undefined = await this.getPairedRegions(locationName);
            if (pairedRegions.length > 0) {
                // if there is at least one region listed, return the first
                wizardContext.telemetry.properties.aiLocationSupported = 'pairedRegion';
                return pairedRegions[0];
            }

            wizardContext.telemetry.properties.aiLocationSupported = 'false';
            return undefined;
        }
    }

    private async getPairedRegions(locationName: string): Promise<string[]> {
        try {
            const client: ServiceClient = await createGenericClient();
            const response: HttpOperationResponse = await client.sendRequest({
                method: 'GET',
                url: 'https://appinsights.azureedge.net/portal/regionMapping.json'
            });
            const regionMappingJson: RegionMappingJsonResponse = <RegionMappingJsonResponse>response.parsedBody;

            if (regionMappingJson.regions[locationName]) {
                return regionMappingJson.regions[locationName].pairedRegions;
            }
        } catch (error) {
            // ignore the error
        }
        return [];
    }

    private async getLocations(wizardContext: IAppServiceWizardContext): Promise<string[] | undefined> {
        const resourceClient: ResourceManagementClient = await createResourceClient(wizardContext);
        const supportedRegions: ResourceManagementModels.Provider = await resourceClient.providers.get('microsoft.insights');
        const componentsResourceType: ResourceManagementModels.ProviderResourceType | undefined = supportedRegions.resourceTypes && supportedRegions.resourceTypes.find(aiRt => aiRt.resourceType === 'components');
        if (!!componentsResourceType && !!componentsResourceType.locations) {
            return componentsResourceType.locations;
        } else {
            return undefined;
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
