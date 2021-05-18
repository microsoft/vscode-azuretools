/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from '@azure/arm-appservice';
import { LocationListStep } from 'vscode-azureextensionui';
import { webProvider } from '../constants';
import { createWebSiteClient } from '../utils/azureClients';
import { nonNullProp } from '../utils/nonNull';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

/**
 * Overwrite the generic 'locationsTask' with a list of locations specific to provider "Microsoft.Web", based on OS and sku
 */
export async function setLocationsTask(wizardContext: IAppServiceWizardContext): Promise<void> {
    LocationListStep.setLocationSubset(wizardContext, getWebLocations(wizardContext), webProvider);
}

export async function getWebLocations(wizardContext: IAppServiceWizardContext): Promise<string[]> {
    let options: WebSiteManagementModels.WebSiteManagementClientListGeoRegionsOptionalParams = {};
    if (wizardContext.newSiteOS === WebsiteOS.linux) {
        if (wizardContext.newSiteKind === AppKind.functionapp && wizardContext.useConsumptionPlan) {
            options = { linuxDynamicWorkersEnabled: true };
        } else {
            options = { linuxWorkersEnabled: true };
        }
    }

    if (wizardContext.newPlanSku && wizardContext.newPlanSku.tier) {
        options.sku = <WebSiteManagementModels.SkuName>wizardContext.newPlanSku.tier.replace(/\s/g, '');
    }

    const client: WebSiteManagementClient = await createWebSiteClient(wizardContext);
    const locations = await client.listGeoRegions(options);
    return locations.map(l => nonNullProp(l, 'name'));
}
