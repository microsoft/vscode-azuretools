/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ServiceLinkerManagementClient } from "@azure/arm-servicelinker";
import { createAzureSubscriptionClient } from "@microsoft/vscode-azext-azureutils";
import { ICreateLinkerContext } from "./createLinker/ICreateLinkerContext";

export async function createLinkerClient(context: ICreateLinkerContext): Promise<ServiceLinkerManagementClient> {
    return createAzureSubscriptionClient(context, (await import('@azure/arm-servicelinker')).ServiceLinkerManagementClient)
}
