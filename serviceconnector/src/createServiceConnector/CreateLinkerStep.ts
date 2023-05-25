/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ServiceLinkerManagementClient } from "@azure/arm-servicelinker";
import { AzureWizardExecuteStep, nonNullValue } from "@microsoft/vscode-azext-utils";
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export class CreateLinkerStep extends AzureWizardExecuteStep<ICreateLinkerContext>{
    public priority: number = 200;

    public async execute(context: ICreateLinkerContext): Promise<void> {
        const client = new ServiceLinkerManagementClient(context.credentials);

        context.linker = {
            authInfo: context.authType,
            targetService: {
                type: "AzureResource",
                id: context.storageAccount?.id + nonNullValue(context.serviceType?.id)
            },
            scope: context.scope,
            clientType: context.clientType
        };

        await client.linker.beginCreateOrUpdate(nonNullValue(context.resourceUri), nonNullValue(context.linkerName), context.linker);
    }

    public shouldExecute(context: ICreateLinkerContext): boolean {
        return !context.linker;
    }
}
