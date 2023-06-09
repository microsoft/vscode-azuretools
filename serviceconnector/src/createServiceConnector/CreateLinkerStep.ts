/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, nonNullValue } from "@microsoft/vscode-azext-utils";
import { createServiceConnectorClient } from "../serviceConnectorClient";
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export class CreateLinkerStep extends AzureWizardExecuteStep<ICreateLinkerContext>{
    public priority: number = 10;

    public async execute(context: ICreateLinkerContext): Promise<void> {
        const client = await createServiceConnectorClient(context.credentials);

        context.linker = {
            authInfo: context.authType,
            targetService: {
                type: "AzureResource",
                id: context.storageAccount?.id + nonNullValue(context.targetServiceType?.id)
            },
            scope: context.scope,
            clientType: context.clientType
        };

        await client.linker.beginCreateOrUpdate(nonNullValue(context.sourceResourceUri), nonNullValue(context.linkerName), context.linker);
    }

    public shouldExecute(context: ICreateLinkerContext): boolean {
        return !context.linker;
    }
}
