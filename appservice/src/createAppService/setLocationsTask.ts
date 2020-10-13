/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from '@azure/arm-appservice';
import { createWebSiteClient } from '../utils/azureClients';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

/**
 * Overwrite the generic 'locationsTask' with a list of locations specific to provider "Microsoft.Web", based on OS and sku
 */
export async function setLocationsTask(wizardContext: IAppServiceWizardContext): Promise<void> {
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
    wizardContext.locationsTask = client.listGeoRegions(options);
}
