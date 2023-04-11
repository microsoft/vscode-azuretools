/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Provider, ProviderResourceType, ResourceManagementClient } from '@azure/arm-resources';
import { ServiceClient } from '@azure/core-client';
import { createPipelineRequest } from '@azure/core-rest-pipeline';
import { AzExtLocation, AzExtPipelineResponse, createGenericClient } from "@microsoft/vscode-azext-azureutils";
import { IActionContext, nonNullProp } from "@microsoft/vscode-azext-utils";
import { createResourceClient } from "../utils/azureClients";
import { areLocationNamesEqual } from "../utils/azureUtils";
import { IAppServiceWizardContext } from "./IAppServiceWizardContext";

// returns the supported location, a location in the region map, or undefined
export async function getAppInsightsSupportedLocation(context: IAppServiceWizardContext, location: AzExtLocation): Promise<string | undefined> {
    const locations: string[] = await getLocations(context) || [];
    const locationName: string = nonNullProp(location, 'name');

    if (locations.some((loc) => areLocationNamesEqual(loc, location.name))) {
        context.telemetry.properties.aiLocationSupported = 'true';
        return locationName;
    } else {
        // If there is no exact match, then query the regionMapping.json
        const pairedRegions: string[] | undefined = await getPairedRegions(context, locationName);
        if (pairedRegions.length > 0) {
            // if there is at least one region listed, return the first
            context.telemetry.properties.aiLocationSupported = 'pairedRegion';
            return pairedRegions[0];
        }

        context.telemetry.properties.aiLocationSupported = 'false';
        return undefined;
    }
}

async function getPairedRegions(context: IActionContext, locationName: string): Promise<string[]> {
    try {
        const client: ServiceClient = await createGenericClient(context, undefined);
        const response: AzExtPipelineResponse = await client.sendRequest(createPipelineRequest({
            method: 'GET',
            url: 'https://appinsights.azureedge.net/portal/regionMapping.json'
        }));

        const regionMappingJson: RegionMappingJsonResponse = <RegionMappingJsonResponse>response.parsedBody;

        if (regionMappingJson.regions[locationName]) {
            return regionMappingJson.regions[locationName].pairedRegions;
        }
    } catch (error) {
        // ignore the error
    }
    return [];
}

async function getLocations(context: IAppServiceWizardContext): Promise<string[] | undefined> {
    const resourceClient: ResourceManagementClient = await createResourceClient(context);
    const supportedRegions: Provider = await resourceClient.providers.get('microsoft.insights');
    const componentsResourceType: ProviderResourceType | undefined = supportedRegions.resourceTypes && supportedRegions.resourceTypes.find(aiRt => aiRt.resourceType === 'components');
    if (!!componentsResourceType && !!componentsResourceType.locations) {
        return componentsResourceType.locations;
    } else {
        return undefined;
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
