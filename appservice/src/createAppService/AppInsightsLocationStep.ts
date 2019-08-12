/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from "azure-arm-resource";
import { Provider, ProviderResourceType } from "azure-arm-resource/lib/resource/models";
import { Location } from "azure-arm-resource/lib/subscription/models";
import { AzureWizardPromptStep, createAzureClient, IAzureQuickPickItem, IAzureQuickPickOptions, LocationListStep } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { nonNullProp } from "../utils/nonNull";
import { requestUtils } from "../utils/requestUtils";
import { IAppServiceWizardContext } from "./IAppServiceWizardContext";

export class AppInsightsLocationStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        const options: IAzureQuickPickOptions = { placeHolder: localize('locationAppInsights', 'Select a location for the new App Insights component.'), id: `AppInsightsLocationStep/${wizardContext.subscriptionId}` };
        wizardContext.newAppInsightsLocation = (await ext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).label;
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.appInsightsComponent && !wizardContext.newAppInsightsLocation;
    }

    public async getSupportedLocation(wizardContext: IAppServiceWizardContext, location: Location): Promise<string | undefined> {
        const resourceClient: ResourceManagementClient = createAzureClient(wizardContext, ResourceManagementClient);
        const supportedRegions: Provider = await resourceClient.providers.get('microsoft.insights');
        const componentsResourceType: ProviderResourceType | undefined = supportedRegions.resourceTypes && supportedRegions.resourceTypes.find(aiRt => aiRt.resourceType === 'components');
        const locationName: string = nonNullProp(location, 'name');
        // still need to do a name step
        if (!!componentsResourceType && !!componentsResourceType.locations && componentsResourceType.locations.some((loc) => loc === location.displayName)) {
            wizardContext.telemetry.properties.locationSupported = 'true';
            return locationName;
        } else {
            // If there is no exact match, then query the regionMapping.json
            const pairedRegions: string[] | undefined = await this.getPairedRegions(locationName);
            if (pairedRegions.length > 0) {
                // if there is at least one region listed, return the first
                wizardContext.telemetry.properties.locationSupported = 'pairedRegion';
                return pairedRegions[0];
            }

            wizardContext.telemetry.properties.locationSupported = 'false';
            return undefined;
        }
    }

    public async getPairedRegions(locationName: string): Promise<string[]> {
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

    private async getQuickPicks(wizardContext: IAppServiceWizardContext): Promise<IAzureQuickPickItem<string | undefined>[]> {
        let picks: IAzureQuickPickItem<string | undefined>[] = [];
        const locationName: string = nonNullProp(nonNullProp(wizardContext, 'location'), 'name');
        let pairedRegions: string[] = [locationName];
        pairedRegions = pairedRegions.concat(await this.getPairedRegions(locationName));

        const locations: Location[] = await LocationListStep.getLocations(wizardContext);
        const recommended: string = 'Recommended';
        picks = picks.concat(locations.map((loc: Location) => {
            return {
                id: loc.id,
                // tslint:disable-next-line:no-non-null-assertion
                label: loc.displayName!,
                description: pairedRegions.find((pr) => pr === loc.name) ? recommended : '',
                data: loc.name
            };
        }));

        return picks.sort((a, b) => {
            if (a.description === recommended) {
                return -1;
            } else if
                (b.description === recommended) {
                return 1;
            } else {
                return 0;
            }
        });
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
