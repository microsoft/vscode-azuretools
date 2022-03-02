/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { GeoRegion, ListGeoRegionsOptionalParams, SkuName } from '@azure/arm-appservice';
import { HttpOperationResponse } from '@azure/ms-rest-js';
import { createGenericClient, LocationListStep } from '@microsoft/vscode-azext-azureutils';
import { nonNullProp } from '@microsoft/vscode-azext-utils';
import { webProvider } from '../constants';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

type GeoRegionJsonResponse = {
    value: GeoRegion[];
};

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

    // Temporary fix for https://github.com/Azure/azure-rest-api-specs/issues/18071
    const genericClient = await createGenericClient(context, context);
    const result: HttpOperationResponse = await genericClient.sendRequest({
        method: 'GET',
        pathTemplate: `/providers/Microsoft.Web/geoRegions`,
        queryParameters: {
            'api-version': '2020-09-01',
            ...options,
        }
    });

    return (<GeoRegionJsonResponse>result.parsedBody).value.map((l: GeoRegion) => nonNullProp(l, 'name'));
}
