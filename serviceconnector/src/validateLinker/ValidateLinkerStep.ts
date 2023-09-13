/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, GenericTreeItem, nonNullProp, randomUtils } from "@microsoft/vscode-azext-utils";
import { ThemeColor, ThemeIcon } from "vscode";
import { IPickLinkerContext } from "../deleteLinker/IPickLinkerContext";
import { createLinkerClient } from "../linkerClient";

export class ValidateLinkerStep extends AzureWizardExecuteStep<IPickLinkerContext> {
    public priority: number = 10;

    public async execute(context: IPickLinkerContext): Promise<void> {
        const client = await createLinkerClient(context.credentials);
        const response = await client.linker.beginValidateAndWait(nonNullProp(context, 'sourceResourceUri'), nonNullProp(context, 'linkerName'));

        context.activityChildren = [];

        for (const detail of nonNullProp(response, 'validationDetail')) {
            if (detail.result === "failure") {
                context.activityChildren.push(new GenericTreeItem(undefined, {
                    contextValue: `validateResult-${detail.name}-` + randomUtils.getRandomHexString(3),
                    label: nonNullProp(detail, 'name'),
                    iconPath: new ThemeIcon('error', new ThemeColor('testing.iconFailed'))
                }));
                throw new Error(detail.description);
            } else {
                context.activityChildren.push(new GenericTreeItem(undefined, {
                    contextValue: `validateResult-${detail.name}` + randomUtils.getRandomHexString(3),
                    label: nonNullProp(detail, 'name'),
                    iconPath: new ThemeIcon('pass', new ThemeColor('testing.iconPassed'))
                }));
            }
        }
    }

    public shouldExecute(): boolean {
        return true;
    }
}
