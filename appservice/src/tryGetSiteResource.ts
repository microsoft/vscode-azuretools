/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AppServicePlansGetResponse, WebAppsGetResponse, WebAppsGetSlotResponse, WebSiteManagementClient } from '@azure/arm-appservice';
import { parseError } from '@microsoft/vscode-azext-utils';

export async function tryGetAppServicePlan(client: WebSiteManagementClient, resourceGroupName: string, name: string): Promise<AppServicePlansGetResponse | undefined> {
    return await tryGetSiteResource(async () => await client.appServicePlans.get(resourceGroupName, name));
}

export async function tryGetWebApp(client: WebSiteManagementClient, resourceGroupName: string, name: string): Promise<WebAppsGetResponse | undefined> {
    return await tryGetSiteResource(async () => await client.webApps.get(resourceGroupName, name));
}

export async function tryGetWebAppSlot(client: WebSiteManagementClient, resourceGroupName: string, name: string, slot: string): Promise<WebAppsGetSlotResponse | undefined> {
    return await tryGetSiteResource(async () => await client.webApps.getSlot(resourceGroupName, name, slot));
}

async function tryGetSiteResource<T>(callback: () => Promise<T>): Promise<T | undefined> {
    try {
        return await callback();
    } catch (error) {
        const regExp: RegExp = /NotFound/i;
        if (regExp.test(parseError(error).errorType)) {
            return undefined;
        } else {
            throw error;
        }
    }
}
