/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, GenericTreeItem, nonNullProp, randomUtils } from "@microsoft/vscode-azext-utils";
import { createLinkerClient } from "../linkerClient";
import { IPickLinkerContext } from "./IPickLinkerContext";

export class DeleteLinkerStep extends AzureWizardExecuteStep<IPickLinkerContext> {
    public priority: number = 10;

    public async execute(context: IPickLinkerContext): Promise<void> {
        const client = await createLinkerClient(context);
        const config = await client.linker.listConfigurations(nonNullProp(context, 'sourceResourceUri'), nonNullProp(context, 'linkerName'));

        context.activityChildren = [];
        for (const item of nonNullProp(config, 'configurations')) {
            context.activityChildren.push(new GenericTreeItem(undefined, {
                contextValue: `createResult-` + randomUtils.getRandomHexString(3),
                label: `Deleted application setting: ${nonNullProp(item, 'name')}`,

            }));
        }

        await client.linker.beginDeleteAndWait(nonNullProp(context, 'sourceResourceUri'), nonNullProp(context, 'linkerName'));
    }

    public shouldExecute(): boolean {
        return true;
    }
}
