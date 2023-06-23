/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, nonNullValue } from "@microsoft/vscode-azext-utils";
import { IPickLinkerContext } from "../deleteLinker/IPickLinkerContext";
import { createLinkerClient } from "../linkerClient";

export class ValidateLinkerStep extends AzureWizardExecuteStep<IPickLinkerContext> {
    public priority: number = 10;

    public async execute(context: IPickLinkerContext): Promise<void> {
        const client = await createLinkerClient(context.credentials);
        const response = await client.linker.beginValidateAndWait(nonNullValue(context.sourceResourceUri), nonNullValue(context.linkerName));
        for (const detail of nonNullValue(response.validationDetail)) {
            if (detail.result === "failure") {
                throw new Error(detail.description);
            }
        }
    }

    public shouldExecute(): boolean {
        return true;
    }
}
