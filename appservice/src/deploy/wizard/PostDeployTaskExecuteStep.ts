/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfig } from "@azure/arm-appservice";
import { ActivityChildItem, ActivityChildType, activityFailContext, activityFailIcon, activitySuccessContext, activitySuccessIcon, AzureWizardExecuteStep, createContextValue, ExecuteActivityOutput } from "@microsoft/vscode-azext-utils";
import { l10n, Progress, Task, Uri, workspace } from "vscode";
import { ext } from "../../extensionVariables";
import { taskUtils } from "../../utils/taskUtils";
import { InnerDeployContext } from "../IDeployContext";
import { shouldExecuteTask } from "../runDeployTask";

export class PostDeployTaskExecuteStep extends AzureWizardExecuteStep<InnerDeployContext> {
    public priority: number = 300;
    public constructor(readonly config: SiteConfig) {
        super();
    }
    public stepName: string = 'PostDeployTaskExecuteStep';
    public createSuccessOutput(context: InnerDeployContext): ExecuteActivityOutput {
        const settingKey: string = 'postDeployTask';
        const taskName: string | undefined = workspace.getConfiguration(ext.prefix, Uri.file(context.fsPath)).get(settingKey) ?? '';
        const label = l10n.t('Started {0} "{1}".', settingKey, taskName);
        return {
            item: new ActivityChildItem({
                contextValue: createContextValue([activitySuccessContext, context.site.id]),
                label,
                iconPath: activitySuccessIcon,
                activityType: ActivityChildType.Success,

            })
        };
    }
    public createFailOutput(context: InnerDeployContext): ExecuteActivityOutput {
        return {
            item: new ActivityChildItem({
                contextValue: createContextValue([activityFailContext, context.site.id]),
                label: l10n.t('Post deploy task failed.'),
                iconPath: activityFailIcon,
                activityType: ActivityChildType.Fail,

            })
        };
    }

    public async execute(context: InnerDeployContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const settingKey: string = 'postDeployTask';
        const taskName: string | undefined = workspace.getConfiguration(ext.prefix, Uri.file(context.fsPath)).get(settingKey);
        context.telemetry.properties.hasPostDeployTask = String(!!taskName);

        if (taskName) {
            const task: Task | undefined = await taskUtils.findTask(context.fsPath, taskName);
            context.telemetry.properties.foundPostDeployTask = String(!!task);
            if (task) {
                await taskUtils.executeIfNotActive(task);
                const startedTask = l10n.t('Started {0} "{1}".', settingKey, taskName);
                progress.report({ message: startedTask });
                ext.outputChannel.appendLog(startedTask, { resourceName: context.site.fullName });
            } else {
                const failedToFindTask = l10n.t('Failed to find {0} "{1}".', settingKey, taskName);
                throw new Error(failedToFindTask);
            }
        }
    }

    public shouldExecute(context: InnerDeployContext): boolean {
        const settingKey: string = 'postDeployTask';
        const taskName: string | undefined = workspace.getConfiguration(ext.prefix, Uri.file(context.fsPath)).get(settingKey);
        return !!(taskName && shouldExecuteTask(context, this.config.scmType, settingKey, taskName))
    }
}
