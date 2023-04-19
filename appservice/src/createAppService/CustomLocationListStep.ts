/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtLocation, LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { IAzureQuickPickItem, IAzureQuickPickOptions, parseError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { createResourceGraphClient } from '../utils/azureClients';
import { CustomLocation, IAppServiceWizardContext } from './IAppServiceWizardContext';

export class CustomLocationListStep<T extends IAppServiceWizardContext> extends LocationListStep<T> {
    public async prompt(context: T): Promise<void> {
        const options: IAzureQuickPickOptions = { placeHolder: vscode.l10n.t('Select a location for new resources.'), enableGrouping: true };
        const result: AzExtLocation | CustomLocation = (await context.ui.showQuickPick(this.getCustomQuickPicks(context), options)).data;
        if ('kubeEnvironment' in result) {
            context.telemetry.properties.pickedCustomLoc = 'true';
            context.customLocation = result;
            // For any resources other than the app, we still need a non-custom location, so we'll use the kubeEnvironment's location
            await LocationListStep.setLocation(context, result.kubeEnvironment.location);
            // Plan has very little effect when a custom location is used, so default this info instead of prompting
            context.newPlanName = await context.relatedNameTask;
            context.newPlanSku = { name: 'K1', tier: 'Kubernetes', size: 'K1', family: 'K', capacity: 1 };
            context.useConsumptionPlan = false;
        } else {
            context.telemetry.properties.pickedCustomLoc = 'false';
            await LocationListStep.setLocation(context, result.name);
        }
    }

    protected async getCustomQuickPicks(context: T): Promise<IAzureQuickPickItem<AzExtLocation | CustomLocation>[]> {
        const picks: IAzureQuickPickItem<AzExtLocation | CustomLocation>[] = await super.getQuickPicks(context);
        if (context.newSiteOS !== 'windows') {
            try {
                const client = await createResourceGraphClient(context);
                const response = await client.resources({
                    query: customLocationQuery,
                    subscriptions: [context.subscriptionId]
                });
                let customLocations = <CustomLocation[]>response.data;
                customLocations = customLocations.sort((a, b) => a.name.localeCompare(b.name));
                context.telemetry.properties.hasCustomLoc = String(customLocations.length > 0);
                picks.unshift(...customLocations.map(cl => {
                    return {
                        label: cl.name,
                        group: vscode.l10n.t('Custom'),
                        data: cl
                    };
                }));
            } catch (error) {
                context.telemetry.properties.customLocationError = parseError(error).message;
                // ignore error and display non-custom locations
            }
        }
        return picks;
    }
}

const customLocationQuery: string = `
Resources
| where type contains 'Microsoft.Web/kubeEnvironments'
| project kubeEnvironment=pack('id', id, 'name', name, 'location', location, 'properties', properties, 'extendedLocation', extendedLocation), customLocationId=tolower(tostring(extendedLocation.name))
| where isnotnull(customLocationId)
| join (Resources
    | where type contains 'Microsoft.ExtendedLocation/customLocations'
    | project name, customLocationId=tolower(tostring(id)), id) on customLocationId
| project kubeEnvironment, name, id
`;
