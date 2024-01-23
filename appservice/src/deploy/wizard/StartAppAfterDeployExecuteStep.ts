/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ext } from "@microsoft/vscode-azext-github";
import { AzureWizardExecuteStep } from "@microsoft/vscode-azext-utils";
import { Progress, l10n } from "vscode";
import { InnerDeployContext } from "../IDeployContext";

export class StartAppAfterDeployExecuteStep extends AzureWizardExecuteStep<InnerDeployContext> {
    public priority: number = 900;
    public async execute(context: InnerDeployContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const site = context.site;

        const client = await site.createClient(context);
        const startingApp = l10n.t('Starting app...');
        progress.report({ message: startingApp });
        ext.outputChannel.appendLog(startingApp, { resourceName: site.fullName });
        await client.start();
    }

    public shouldExecute(_context: InnerDeployContext): boolean {
        return true;
    }
}
