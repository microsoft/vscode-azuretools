/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ListGeoRegionsOptionalParams, SkuName, WebSiteManagementClient } from '@azure/arm-appservice';
import { LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { webProvider } from '../constants';
import { createWebSiteClient } from '../utils/azureClients';
import { nonNullProp } from '../utils/nonNull';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

/**
 * Overwrite the generic 'locationsTask' with a list of locations specific to provider "Microsoft.Web", based on OS and sku
 */
export async function setLocationsTask(context: IAppServiceWizardContext): Promise<void> {
    LocationListStep.setLocationSubset(context, getWebLocations(context), webProvider);
}

export async function getWebLocations(context: IAppServiceWizardContext): Promise<string[]> {
    let options: ListGeoRegionsOptionalParams = {};
    if (context.newSiteOS === WebsiteOS.linux) {
        if (context.newSiteKind === AppKind.functionapp && context.useConsumptionPlan) {
            options = { linuxDynamicWorkersEnabled: true };
        } else {
            options = { linuxWorkersEnabled: true };
        }
    }

    if (context.newPlanSku && context.newPlanSku.tier) {
        options.sku = <SkuName>context.newPlanSku.tier.replace(/\s/g, '');
    }

    const client: WebSiteManagementClient = await createWebSiteClient(context);
    const locations = await client.listGeoRegions(options);
    return locations.map(l => nonNullProp(l, 'name'));
}
