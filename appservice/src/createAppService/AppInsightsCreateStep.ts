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
import { requestUtils } from '../utils/requestUtils';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 135;

    public async execute(wizardContext: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const resourceLocation: Location = nonNullProp(wizardContext, 'location');
        const verifyingAppInsightsAvailable: string = localize('verifyingAppInsightsAvailable', 'Verifying that Application Insights is available for this location...');
        ext.outputChannel.appendLine(verifyingAppInsightsAvailable);
        const appInsightsLocation: string | undefined = await this.getSupportedLocation(wizardContext, resourceLocation);

        if (appInsightsLocation) {
            const client: ApplicationInsightsManagementClient = createAzureClient(wizardContext, ApplicationInsightsManagementClient);
            const rgName: string = nonNullValue(wizardContext.newResourceGroupName);
            const aiName: string = nonNullValue(wizardContext.newAppInsightsName);

            try {
                wizardContext.appInsightsComponent = await client.components.get(rgName, aiName);
                ext.outputChannel.appendLine(localize('existingNewAppInsights', 'Using existing Application Insights resource "{0}".', aiName));
            } catch (error) {
                const pError: IParsedError = parseError(error);
                // Only expecting a resource not found error if this is a new component
                if (pError.errorType === 'ResourceNotFound') {
                    const creatingNewAppInsights: string = localize('creatingNewAppInsightsInsights', 'Creating new Application Insights resource "{0}"...', wizardContext.newSiteName);
                    ext.outputChannel.appendLine(creatingNewAppInsights);
                    progress.report({ message: creatingNewAppInsights });

                    wizardContext.appInsightsComponent = await client.components.createOrUpdate(rgName, aiName, { kind: 'web', applicationType: 'web', location: appInsightsLocation });
                    const createdNewAppInsights: string = localize('createdNewAppInsights', 'Created new Application Insights resource "{0}"...', aiName);
                    ext.outputChannel.appendLine(createdNewAppInsights);
                } else {
                    throw error;
                }
            }
        } else {
            const appInsightsNotAvailable: string = localize('appInsightsNotAvailable', 'Skipping creating an Application Insights resource because it isn\'t compatible with this location.');
            ext.outputChannel.appendLine(appInsightsNotAvailable);
        }
    }

    public shouldExecute(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.appInsightsComponent && !!wizardContext.newAppInsightsName;
    }

    // returns the supported location, a location in the region map, or undefined
    private async getSupportedLocation(wizardContext: IAppServiceWizardContext, location: Location): Promise<string | undefined> {
        // tslint:disable-next-line: strict-boolean-expressions
        const locations: string[] = await this.getLocations(wizardContext) || [];
        const locationName: string = nonNullProp(location, 'name');

        if (locations.some((loc) => loc === location.displayName)) {
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
            const request: requestUtils.Request = await requestUtils.getDefaultRequest('https://appinsights.azureedge.net/portal/regionMapping.json');
            const response: string = await requestUtils.sendRequest(request);
            const regionMappingJson: RegionMappingJsonResponse = <RegionMappingJsonResponse>JSON.parse(response);

            // tslint:disable-next-line: strict-boolean-expressions
            if (regionMappingJson.regions[locationName]) {
                return regionMappingJson.regions[locationName].pairedRegions;
            }
        } catch (error) {
            // ignore the error
        }
        return [];
    }

    private async getLocations(wizardContext: IAppServiceWizardContext): Promise<string[] | undefined> {
        const resourceClient: ResourceManagementClient = createAzureClient(wizardContext, ResourceManagementClient);
        const supportedRegions: Provider = await resourceClient.providers.get('microsoft.insights');
        const componentsResourceType: ProviderResourceType | undefined = supportedRegions.resourceTypes && supportedRegions.resourceTypes.find(aiRt => aiRt.resourceType === 'components');
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
