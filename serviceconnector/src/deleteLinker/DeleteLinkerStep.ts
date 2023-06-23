/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, nonNullValue } from "@microsoft/vscode-azext-utils";
import { createLinkerClient } from "../linkerClient";
import { IPickLinkerContext } from "./IPickLinkerContext";

export class DeleteLinkerStep extends AzureWizardExecuteStep<IPickLinkerContext> {
    public priority: number = 10;

    public async execute(context: IPickLinkerContext): Promise<void> {
        const client = await createLinkerClient(context.credentials);
        await client.linker.beginDeleteAndWait(nonNullValue(context.sourceResourceUri), nonNullValue(context.linkerName));
    }

    public shouldExecute(): boolean {
        return true;
    }
}
