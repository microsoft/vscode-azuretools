/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Extension } from "vscode";
import { AzureExtensionApi, AzureExtensionApiProvider } from "../../api";
import { getPackageInfo } from "../getPackageInfo";

class ExtensionNotFoundError extends Error {
    constructor(extensionId: string) {
        super(`Extension with id ${extensionId} not found.`);
    }
}

export async function getAzureExtensionApi<T extends AzureExtensionApi>(extensionId: string, apiVersionRange: string): Promise<T> {
    const apiProvider: AzureExtensionApiProvider | undefined = await getExtensionExports(extensionId);

    if (apiProvider) {
        return apiProvider.getApi<T>(apiVersionRange, {
            extensionId: getPackageInfo().extensionId
        });
    }

    throw new ExtensionNotFoundError(extensionId);
}

export async function getExtensionExports<T>(extensionId: string): Promise<T | undefined> {
    const extension: Extension<T> | undefined = vscode.extensions.getExtension(extensionId);
    if (extension) {
        if (!extension.isActive) {
            await extension.activate();
        }

        return extension.exports;
    }

    return undefined;
}
