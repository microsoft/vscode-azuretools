/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, GenericTreeItem, nonNullValue, randomUtils } from "@microsoft/vscode-azext-utils";
import { ThemeColor, ThemeIcon } from "vscode";
import { IPickLinkerContext } from "../deleteLinker/IPickLinkerContext";
import { createLinkerClient } from "../linkerClient";

export class ValidateLinkerStep extends AzureWizardExecuteStep<IPickLinkerContext> {
    public priority: number = 10;

    public async execute(context: IPickLinkerContext): Promise<void> {
        const client = await createLinkerClient(context);
        const response = await client.linker.beginValidateAndWait(nonNullValue(context.sourceResourceUri), nonNullValue(context.linkerName));

        context.activityChildren = [];

        for (const detail of nonNullValue(response.validationDetail)) {
            if (detail.result === "failure") {
                context.activityChildren.push(new GenericTreeItem(undefined, {
                    contextValue: `validateResult-${detail.name}-` + randomUtils.getRandomHexString(3),
                    label: nonNullValue(detail.name),
                    iconPath: new ThemeIcon('error', new ThemeColor('testing.iconFailed'))
                }));
                throw new Error(detail.description);
            } else {
                context.activityChildren.push(new GenericTreeItem(undefined, {
                    contextValue: `validateResult-${detail.name}` + randomUtils.getRandomHexString(3),
                    label: nonNullValue(detail.name),
                    iconPath: new ThemeIcon('pass', new ThemeColor('testing.iconPassed'))
                }));
            }
        }
    }

    public shouldExecute(): boolean {
        return true;
    }
}
