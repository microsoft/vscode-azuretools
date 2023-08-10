/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep } from "@microsoft/vscode-azext-utils";
import { InnerDeployContext } from "../IDeployContext";
import { syncTriggersPostDeploy } from "../syncTriggersPostDeploy";

export class PostDeploySyncTriggersExecuteStep extends AzureWizardExecuteStep<InnerDeployContext> {
    public priority: number = 310;
    public async execute(context: InnerDeployContext): Promise<void> {
        // Don't sync triggers if app is stopped https://github.com/microsoft/vscode-azurefunctions/issues/1608
        const state: string | undefined = await context.client.getState();
        if (state?.toLowerCase() === 'running') {
            await syncTriggersPostDeploy(context, context.site);
        }
    }

    public shouldExecute(_context: InnerDeployContext): boolean {
        return true;
    }
}
