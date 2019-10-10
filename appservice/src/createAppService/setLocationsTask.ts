/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from 'azure-arm-website';
import { createAzureClient } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

// Type is not exported in azure-arm-website for some reason, so copying part of it here
interface IListGeoRegionsOptions { sku?: string; linuxWorkersEnabled?: boolean; linuxDynamicWorkersEnabled?: boolean; }

/**
 * Overwrite the generic 'locationsTask' with a list of locations specific to provider "Microsoft.Web", based on OS and sku
 */
export function setLocationsTask(wizardContext: IAppServiceWizardContext): void {
    let options: IListGeoRegionsOptions = {};
    if (wizardContext.newSiteOS === WebsiteOS.linux) {
        if (wizardContext.newSiteKind === AppKind.functionapp && wizardContext.useConsumptionPlan) {
            options = { linuxDynamicWorkersEnabled: true };
        } else {
            options = { linuxWorkersEnabled: true };
        }
    }

    if (wizardContext.newPlanSku && wizardContext.newPlanSku.tier) {
        options.sku = wizardContext.newPlanSku.tier.replace(/\s/g, '');
    }

    const client: WebSiteManagementClient = createAzureClient(wizardContext, WebSiteManagementClient);
    wizardContext.locationsTask = client.listGeoRegions(options);
}
