/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Extension, extensions } from "vscode";
import { localize } from "vscode-nls";
import type { AzureExtensionApi, AzureExtensionApiProvider } from "../../api";
import { AzureHostExtensionApi } from "../../hostapi";

export async function getResourceGroupsApi(apiVersionRange: AzureExtensionApi['apiVersion']): Promise<AzureHostExtensionApi>;
export async function getResourceGroupsApi<T extends AzureExtensionApi>(apiVersionRange: string): Promise<T> {
    const rgApiProvider = await getApiExport<AzureExtensionApiProvider>('ms-azuretools.vscode-azureresourcegroups');
    if (rgApiProvider) {
        return rgApiProvider.getApi<T>(apiVersionRange);
    } else {
        throw new Error(localize('noResourceGroupExt', 'Could not find the Azure Resource Groups extension'));
    }
}

async function getApiExport<T>(extensionId: string): Promise<T | undefined> {
    const extension: Extension<T> | undefined = extensions.getExtension(extensionId);
    if (extension) {
        if (!extension.isActive) {
            await extension.activate();
        }

        return extension.exports;
    }

    return undefined;
}
