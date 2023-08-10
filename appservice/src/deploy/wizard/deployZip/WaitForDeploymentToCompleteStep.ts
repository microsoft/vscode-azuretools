/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, nonNullProp } from "@microsoft/vscode-azext-utils";
import { Progress } from "vscode";
import { InnerDeployContext } from "../../IDeployContext";
import { waitForDeploymentToComplete } from "../../waitForDeploymentToComplete";

export class WaitForDeploymentToCompleteStep extends AzureWizardExecuteStep<InnerDeployContext> {
    public priority: number = 210;
    public async execute(context: InnerDeployContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        return await waitForDeploymentToComplete(context, nonNullProp(context, 'site'), { locationUrl: context.locationUrl, progress });
    }

    public shouldExecute(_context: InnerDeployContext): boolean {
        return true;
    }
}
