/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfig } from "@azure/arm-appservice";
import { AzureWizardExecuteStep } from "@microsoft/vscode-azext-utils";
import { Progress, Task, Uri, l10n, workspace } from "vscode";
import { ext } from "../../extensionVariables";
import { taskUtils } from "../../utils/taskUtils";
import { InnerDeployContext } from "../IDeployContext";
import { shouldExecuteTask } from "../runDeployTask";

export class PostDeployTaskExecuteStep extends AzureWizardExecuteStep<InnerDeployContext> {
    public priority: number = 300;
    public constructor(readonly config: SiteConfig) {
        super();
    }

    public async execute(context: InnerDeployContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const settingKey: string = 'postDeployTask';
        const taskName: string | undefined = workspace.getConfiguration(ext.prefix, Uri.file(context.fsPath)).get(settingKey);
        context.telemetry.properties.hasPostDeployTask = String(!!taskName);

        if (taskName && shouldExecuteTask(context, this.config.scmType, settingKey, taskName)) {
            const task: Task | undefined = await taskUtils.findTask(context.fsPath, taskName);
            context.telemetry.properties.foundPostDeployTask = String(!!task);
            if (task) {
                await taskUtils.executeIfNotActive(task);
                const startedTask = l10n.t('Started {0} "{1}".', settingKey, taskName);
                progress.report({ message: startedTask });
                ext.outputChannel.appendLog(startedTask, { resourceName: context.site.fullName });
            } else {
                const failedToFindTask = l10n.t('Failed to find {0} "{1}".', settingKey, taskName);
                progress.report({ message: failedToFindTask });
                ext.outputChannel.appendLog(failedToFindTask, { resourceName: context.site.fullName });
            }
        }
    }

    public shouldExecute(_context: InnerDeployContext): boolean {
        return true;
    }
}
