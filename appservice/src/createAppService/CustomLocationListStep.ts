/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtLocation, IAzureQuickPickItem, IAzureQuickPickOptions, LocationListStep, parseError } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { createResourceGraphClient } from '../utils/azureClients';
import { CustomLocation, IAppServiceWizardContext } from './IAppServiceWizardContext';

export class CustomLocationListStep<T extends IAppServiceWizardContext> extends LocationListStep<T> {
    public async prompt(wizardContext: T): Promise<void> {
        const options: IAzureQuickPickOptions = { placeHolder: localize('selectLocation', 'Select a location for new resources.'), enableGrouping: true };
        const result: AzExtLocation | CustomLocation = (await wizardContext.ui.showQuickPick(this.getCustomQuickPicks(wizardContext), options)).data;
        if ('kubeEnvironment' in result) {
            wizardContext.customLocation = result;
            // For any resources other than the app, we still need a non-custom location, so we'll use the kubeEnvironment's location
            await LocationListStep.setLocation(wizardContext, result.kubeEnvironment.location);
            // Plan has very little effect when a custom location is used, so default this info instead of prompting
            wizardContext.newPlanName = await wizardContext.relatedNameTask;
            wizardContext.newPlanSku = { name: 'K1', tier: 'Kubernetes', size: 'K1', family: 'K', capacity: 1 };
        } else {
            wizardContext.location = result;
        }
    }

    protected async getCustomQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<AzExtLocation | CustomLocation>[]> {
        const picks: IAzureQuickPickItem<AzExtLocation | CustomLocation>[] = await super.getQuickPicks(wizardContext);
        if (wizardContext.newSiteOS !== 'windows') {
            try {
                const client = await createResourceGraphClient(wizardContext);
                const response = await client.resources({
                    query: customLocationQuery,
                    subscriptions: [wizardContext.subscriptionId]
                });
                let customLocations = <CustomLocation[]>response.data;
                customLocations = customLocations.sort((a, b) => a.name.localeCompare(b.name));
                picks.unshift(...customLocations.map(cl => {
                    return {
                        label: cl.name,
                        group: localize('custom', 'Custom'),
                        data: cl
                    };
                }));
            } catch (error) {
                wizardContext.telemetry.properties.customLocationError = parseError(error).message;
                // ignore error and display non-custom locations
            }
        }
        return picks;
    }
}

const customLocationQuery: string = `
Resources
| where type contains 'Microsoft.Web/kubeEnvironments'
| project kubeEnvironment=pack('id', id, 'name', name, 'location', location, 'properties', properties), customLocationId=tolower(tostring(properties.extendedLocation.customLocation))
| where isnotnull(customLocationId)
| join (Resources
    | where type contains 'Microsoft.ExtendedLocation/customLocations'
    | project name, customLocationId=tolower(tostring(id)), id) on customLocationId
| project kubeEnvironment, name, id
`;
