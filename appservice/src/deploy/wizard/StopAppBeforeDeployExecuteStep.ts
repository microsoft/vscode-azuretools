/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStepWithActivityOutput } from "@microsoft/vscode-azext-utils";
import { Progress, l10n } from "vscode";
import { InnerDeployContext } from "../IDeployContext";

export class StopAppBeforeDeployExecuteStep extends AzureWizardExecuteStepWithActivityOutput<InnerDeployContext> {
    stepName: string = 'StopAppBeforeDeployExecuteStep';
    protected getTreeItemLabel(context: InnerDeployContext): string {
        return context.site.isSlot ? l10n.t('Stop slot "{0}" before deployment', context.site.fullName) : l10n.t('Stop app "{0}" before deployment', context.site.fullName);
    }
    protected getOutputLogSuccess(context: InnerDeployContext): string {
        return context.site.isSlot ? l10n.t('Successfully stopped slot "{0}".', context.site.fullName) : l10n.t('Successfully stopped app "{0}".', context.site.fullName);
    }
    protected getOutputLogFail(context: InnerDeployContext): string {
        return context.site.isSlot ? l10n.t('Failed to stop slot "{0}".', context.site.fullName) : l10n.t('Failed to stop app "{0}".', context.site.fullName);
    }
    protected getOutputLogProgress(context: InnerDeployContext): string {
        return context.site.isSlot ? l10n.t('Stopping slot "{0}"...', context.site.fullName) : l10n.t('Stopping app "{0}"...', context.site.fullName);
    }

    public priority: number = 100;
    public async execute(context: InnerDeployContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const site = context.site;

        const stoppingApp = l10n.t('Stopping app...');
        progress.report({ message: stoppingApp });
        const client = await site.createClient(context);
        await client.stop();
    }

    public shouldExecute(_context: InnerDeployContext): boolean {
        return true;
    }
}
