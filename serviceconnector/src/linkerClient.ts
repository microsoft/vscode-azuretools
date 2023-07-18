/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtServiceClientCredentials } from "@microsoft/vscode-azext-utils";

export async function createLinkerClient(credentials: AzExtServiceClientCredentials) {
    return new (await import('@azure/arm-servicelinker')).ServiceLinkerManagementClient(credentials);
}
