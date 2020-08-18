/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from '@azure/arm-appservice';
import { parseError } from "vscode-azureextensionui";

export async function tryGetAppServicePlan(client: WebSiteManagementClient, resourceGroupName: string, name: string): Promise<WebSiteManagementModels.AppServicePlansGetResponse | undefined> {
    return await tryGetSiteResource(async () => await client.appServicePlans.get(resourceGroupName, name));
}

export async function tryGetWebApp(client: WebSiteManagementClient, resourceGroupName: string, name: string): Promise<WebSiteManagementModels.WebAppsGetResponse | undefined> {
    return await tryGetSiteResource(async () => await client.webApps.get(resourceGroupName, name));
}

export async function tryGetWebAppSlot(client: WebSiteManagementClient, resourceGroupName: string, name: string, slot: string): Promise<WebSiteManagementModels.WebAppsGetSlotResponse | undefined> {
    return await tryGetSiteResource(async () => await client.webApps.getSlot(resourceGroupName, name, slot));
}

async function tryGetSiteResource<T>(callback: () => Promise<T | WebSiteManagementModels.DefaultErrorResponse>): Promise<T | undefined> {
    const result: T | WebSiteManagementModels.DefaultErrorResponse = await callback();
    // https://github.com/Azure/azure-sdk-for-js/issues/10457
    if ('error' in result && parseError(result.error).errorType === 'ResourceNotFound') {
        return undefined;
    } else {
        return <T>result;
    }
}
