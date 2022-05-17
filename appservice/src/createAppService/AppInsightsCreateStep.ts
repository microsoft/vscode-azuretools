/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ApplicationInsightsManagementClient } from '@azure/arm-appinsights';
import type { Provider, ProviderResourceType, ResourceGroup, ResourceManagementClient } from '@azure/arm-resources';
import type { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import { AzExtLocation, createGenericClient, LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStep, IActionContext, IParsedError, nonNullProp, parseError } from '@microsoft/vscode-azext-utils';
import { MessageItem, Progress } from 'vscode';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { createAppInsightsClient, createResourceClient } from '../utils/azureClients';
import { areLocationNamesEqual } from '../utils/azureUtils';
import { AppInsightsListStep } from './AppInsightsListStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 135;

    public async execute(context: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const resourceLocation: AzExtLocation = await LocationListStep.getLocation(context);
        const verifyingAppInsightsAvailable: string = localize('verifyingAppInsightsAvailable', 'Verifying that Application Insights is available for this location...');
        ext.outputChannel.appendLog(verifyingAppInsightsAvailable);
        const appInsightsLocation: string | undefined = await this.getSupportedLocation(context, resourceLocation);

        if (appInsightsLocation) {
            const client: ApplicationInsightsManagementClient = await createAppInsightsClient(context);
            const rg: ResourceGroup = nonNullProp(context, 'resourceGroup');
            const rgName: string = nonNullProp(rg, 'name');
            const aiName: string = nonNullProp(context, 'newAppInsightsName');

            try {
                context.appInsightsComponent = await client.components.get(rgName, aiName);
                ext.outputChannel.appendLog(localize('existingNewAppInsights', 'Using existing Application Insights resource "{0}".', aiName));
            } catch (error) {
                const pError: IParsedError = parseError(error);
                // Only expecting a resource not found error if this is a new component
                if (pError.errorType === 'ResourceNotFound') {
                    const creatingNewAppInsights: string = localize('creatingNewAppInsightsInsights', 'Creating Application Insights resource "{0}"...', aiName);
                    ext.outputChannel.appendLog(creatingNewAppInsights);
                    progress.report({ message: creatingNewAppInsights });

                    context.appInsightsComponent = await client.components.createOrUpdate(rgName, aiName, { kind: 'web', applicationType: 'web', location: appInsightsLocation });
                    const createdNewAppInsights: string = localize('createdNewAppInsights', 'Successfully created Application Insights resource "{0}".', aiName);
                    ext.outputChannel.appendLog(createdNewAppInsights);
                } else if (pError.errorType === 'AuthorizationFailed') {
                    if (!context.advancedCreation) {
                        const appInsightsNotAuthorized: string = localize('appInsightsNotAuthorized', 'Skipping Application Insights resource because you do not have permission to create one in this subscription.');
                        ext.outputChannel.appendLog(appInsightsNotAuthorized);
                    } else {
                        await this.selectExistingPrompt(context);
                    }
                } else {
                    throw error;
                }
            }
        } else {
            const appInsightsNotAvailable: string = localize('appInsightsNotAvailable', 'Skipping Application Insights resource because it isn\'t compatible with this location.');
            ext.outputChannel.appendLog(appInsightsNotAvailable);
        }
    }

    public async selectExistingPrompt(context: IAppServiceWizardContext): Promise<void> {
        const message: string = localize('aiForbidden', 'You do not have permission to create an app insights resource in subscription "{0}".', context.subscriptionDisplayName);
        const selectExisting: MessageItem = { title: localize('selectExisting', 'Select Existing') };
        const skipForNow: MessageItem = { title: localize('skipForNow', 'Skip for Now') };
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

    // returns the supported location, a location in the region map, or undefined
    private async getSupportedLocation(context: IAppServiceWizardContext, location: AzExtLocation): Promise<string | undefined> {
        const locations: string[] = await this.getLocations(context) || [];
        const locationName: string = nonNullProp(location, 'name');

        if (locations.some((loc) => areLocationNamesEqual(loc, location.name))) {
            context.telemetry.properties.aiLocationSupported = 'true';
            return locationName;
        } else {
            // If there is no exact match, then query the regionMapping.json
            const pairedRegions: string[] | undefined = await this.getPairedRegions(context, locationName);
            if (pairedRegions.length > 0) {
                // if there is at least one region listed, return the first
                context.telemetry.properties.aiLocationSupported = 'pairedRegion';
                return pairedRegions[0];
            }

            context.telemetry.properties.aiLocationSupported = 'false';
            return undefined;
        }
    }

    private async getPairedRegions(context: IActionContext, locationName: string): Promise<string[]> {
        try {
            const client: ServiceClient = await createGenericClient(context, undefined);
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

    private async getLocations(context: IAppServiceWizardContext): Promise<string[] | undefined> {
        const resourceClient: ResourceManagementClient = await createResourceClient(context);
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
