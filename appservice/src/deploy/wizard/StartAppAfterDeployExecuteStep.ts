/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStepWithActivityOutput } from "@microsoft/vscode-azext-utils";
import { Progress, l10n } from "vscode";
import { InnerDeployContext } from "../IDeployContext";

export class StartAppAfterDeployExecuteStep extends AzureWizardExecuteStepWithActivityOutput<InnerDeployContext> {
    public priority: number = 900;
    stepName: string = 'StartAppAfterDeployExecuteStep';
    protected getTreeItemLabel(context: InnerDeployContext): string {
        return context.site.isSlot ? l10n.t('Start slot "{0}" after deployment', context.site.fullName) : l10n.t('Start app "{0}" after deployment', context.site.fullName);
    }
    protected getOutputLogSuccess(context: InnerDeployContext): string {
        return context.site.isSlot ? l10n.t('Successfully started slot "{0}".', context.site.fullName) : l10n.t('Successfully started app "{0}".', context.site.fullName);
    }
    protected getOutputLogFail(context: InnerDeployContext): string {
        return context.site.isSlot ? l10n.t('Failed to start slot "{0}".', context.site.fullName) : l10n.t('Failed to start app "{0}".', context.site.fullName);
    }
    protected getOutputLogProgress(context: InnerDeployContext): string {
        return context.site.isSlot ? l10n.t('Starting slot "{0}"...', context.site.fullName) : l10n.t('Starting app "{0}"...', context.site.fullName);
    }
    public async execute(context: InnerDeployContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const site = context.site;

        const startingApp = context.site.isSlot ? l10n.t('Starting slot...') : l10n.t('Starting app...');
        progress.report({ message: startingApp });
        const client = await site.createClient(context);
        await client.start();
    }

    public shouldExecute(_context: InnerDeployContext): boolean {
        return true;
    }
}
