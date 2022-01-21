/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AppServicePlansGetResponse, DefaultErrorResponse, WebAppsGetResponse, WebAppsGetSlotResponse, WebSiteManagementClient } from '@azure/arm-appservice';
import { parseError } from "vscode-azureextensionui";

export async function tryGetAppServicePlan(client: WebSiteManagementClient, resourceGroupName: string, name: string): Promise<AppServicePlansGetResponse | undefined> {
    return await tryGetSiteResource(async () => await client.appServicePlans.get(resourceGroupName, name));
}

export async function tryGetWebApp(client: WebSiteManagementClient, resourceGroupName: string, name: string): Promise<WebAppsGetResponse | undefined> {
    return await tryGetSiteResource(async () => await client.webApps.get(resourceGroupName, name));
}

export async function tryGetWebAppSlot(client: WebSiteManagementClient, resourceGroupName: string, name: string, slot: string): Promise<WebAppsGetSlotResponse | undefined> {
    return await tryGetSiteResource(async () => await client.webApps.getSlot(resourceGroupName, name, slot));
}

/**
 * Workaround for https://github.com/Azure/azure-sdk-for-js/issues/10457
 * The azure sdk currently returns the error when a resource isn't found. Instead, they should throw the error or return undefined. We will do the latter.
 *
 * Example values for `result`:
 * 1. { "error": { "code": "ResourceGroupNotFound", "message": "Resource group 'appsvc_linux_centralus' could not be found." }}
 * 2. { "error": { "code": "ResourceNotFound", "message": "The Resource 'Microsoft.Web/serverFarms/appsvc_linux_centralus' under resource group 'appsvc_linux_centralus' was not found. For more details please go to https://aka.ms/ARMResourceNotFoundFix" }}
 * 3. { "Code": "NotFound", "Message": "Server farm with name appsvc_linux_centralus not found." }
 */
async function tryGetSiteResource<T>(callback: () => Promise<T | DefaultErrorResponse>): Promise<T | undefined> {
    const result: T | DefaultErrorResponse = await callback();
    const regExp: RegExp = /NotFound/i;
    if (regExp.test(parseError(result).errorType) || ('error' in result && regExp.test(parseError(result.error).errorType))) {
        return undefined;
    } else {
        return <T>result;
    }
}
