/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, nonNullValue } from "@microsoft/vscode-azext-utils";
import { IPickLinkerContext } from "../deleteServiceConnector/IPickLinkerContext";

export class ValidateLinkerStep extends AzureWizardExecuteStep<IPickLinkerContext> {
    public priority: number = 200;

    public async execute(context: IPickLinkerContext): Promise<void> {
        const client = new (await import('@azure/arm-servicelinker')).ServiceLinkerManagementClient(context.credentials);
        await client.linker.beginValidateAndWait(nonNullValue(context.sourceResourceUri), nonNullValue(context.linkerName));
    }

    public shouldExecute(): boolean {
        return true;
    }
}
