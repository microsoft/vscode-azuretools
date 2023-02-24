/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ext } from '../extensionVariables';
import { ScmType } from '../ScmType';
import { taskUtils } from '../utils/taskUtils';
import { IDeployContext } from './IDeployContext';

export async function runPreDeployTask(context: IDeployContext, deployFsPath: string, scmType: string | undefined): Promise<void> {
    const preDeployResult: IPreDeployTaskResult = await tryRunPreDeployTask(context, deployFsPath, scmType);
    if (preDeployResult.failedToFindTask) {
        throw new Error(`Failed to find pre-deploy task "${preDeployResult.taskName}". Modify your tasks or the setting "${ext.prefix}.preDeployTask".`);
    } else if (preDeployResult.exitCode !== undefined && preDeployResult.exitCode !== 0) {
        await handleFailedPreDeployTask(context, preDeployResult);
    }
}

export async function tryRunPreDeployTask(context: IDeployContext, deployFsPath: string, scmType: string | undefined): Promise<IPreDeployTaskResult> {
    const settingKey: string = 'preDeployTask';
    const taskName: string | undefined = vscode.workspace.getConfiguration(ext.prefix, vscode.Uri.file(deployFsPath)).get(settingKey);
    context.telemetry.properties.hasPreDeployTask = String(!!taskName);

    let preDeployTaskResult: IPreDeployTaskResult = { taskName, exitCode: undefined, failedToFindTask: false };

    if (taskName && shouldExecuteTask(context, scmType, settingKey, taskName)) {
        const task: vscode.Task | undefined = await taskUtils.findTask(deployFsPath, taskName);
        context.telemetry.properties.foundPreDeployTask = String(!!task);
        if (task) {
            const progressMessage: string = vscode.l10n.t('Running preDeployTask "{0}"...', taskName);
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: progressMessage }, async () => {
                await taskUtils.executeIfNotActive(task);
                preDeployTaskResult = await waitForPreDeployTask(task, deployFsPath);
                context.telemetry.properties.preDeployTaskExitCode = String(preDeployTaskResult.exitCode);
            });
        } else {
            preDeployTaskResult.failedToFindTask = true;
        }
    }

    return preDeployTaskResult;
}

/**
 * Starts the post deploy task, but doesn't wait for the result (not worth it)
 */
export async function startPostDeployTask(context: IDeployContext, deployFsPath: string, scmType: string | undefined, resourceName: string): Promise<void> {
    const settingKey: string = 'postDeployTask';
    const taskName: string | undefined = vscode.workspace.getConfiguration(ext.prefix, vscode.Uri.file(deployFsPath)).get(settingKey);
    context.telemetry.properties.hasPostDeployTask = String(!!taskName);

    if (taskName && shouldExecuteTask(context, scmType, settingKey, taskName)) {
        const task: vscode.Task | undefined = await taskUtils.findTask(deployFsPath, taskName);
        context.telemetry.properties.foundPostDeployTask = String(!!task);
        if (task) {
            await taskUtils.executeIfNotActive(task);
            ext.outputChannel.appendLog(vscode.l10n.t('Started {0} "{1}".', settingKey, taskName), { resourceName });
        } else {
            ext.outputChannel.appendLog(vscode.l10n.t('WARNING: Failed to find {0} "{1}".', settingKey, taskName), { resourceName });
        }
    }
}

export interface IPreDeployTaskResult {
    taskName: string | undefined;
    exitCode: number | undefined;
    failedToFindTask: boolean;
}

function shouldExecuteTask(context: IDeployContext, scmType: string | undefined, settingKey: string, taskName: string): boolean {
    // We don't run deploy tasks for non-zipdeploy since that stuff should be handled by kudu
    const shouldExecute: boolean = context.deployMethod === 'storage' || context.deployMethod === 'zip' || (scmType !== ScmType.LocalGit && scmType !== ScmType.GitHub);
    if (!shouldExecute) {
        ext.outputChannel.appendLog(vscode.l10n.t('WARNING: Ignoring {0} "{1}" for non-zip deploy.', settingKey, taskName));
    }
    return shouldExecute;
}

async function waitForPreDeployTask(preDeployTask: vscode.Task, deployFsPath: string): Promise<IPreDeployTaskResult> {
    return await new Promise((resolve: (preDeployTaskResult: IPreDeployTaskResult) => void): void => {
        const errorListener: vscode.Disposable = vscode.tasks.onDidEndTaskProcess((e: vscode.TaskProcessEndEvent) => {
            if (taskUtils.isTaskInScopeOfPath(e.execution.task, deployFsPath) && e.exitCode !== 0) {
                // Throw if _any_ task fails since preDeployTasks can depend on other tasks)
                errorListener.dispose();
                resolve({ taskName: e.execution.task.name, exitCode: e.exitCode, failedToFindTask: false });
            }

            // this is the actual preDeployTask that we are waiting on
            if (taskUtils.isTaskEqual(e.execution.task, preDeployTask)) {
                errorListener.dispose();
                resolve({ taskName: e.execution.task.name, exitCode: e.exitCode, failedToFindTask: false });
            }
        });
    });
}

export async function handleFailedPreDeployTask(context: IActionContext, preDeployResult: IPreDeployTaskResult): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const message: string = vscode.l10n.t('Errors exist after running preDeployTask "{0}". See task output for more info.', preDeployResult.taskName!);
    const deployAnyway: vscode.MessageItem = { title: vscode.l10n.t('Deploy Anyway') };
    const openSettings: vscode.MessageItem = { title: vscode.l10n.t('Open Settings') };
    const result: vscode.MessageItem | undefined = await vscode.window.showErrorMessage(message, { modal: true }, deployAnyway, openSettings);
    if (result === deployAnyway) {
        context.telemetry.properties.preDeployTaskResponse = 'deployAnyway';
    } else if (result === openSettings) {
        context.telemetry.properties.preDeployTaskResponse = 'openSettings';
        await vscode.commands.executeCommand('workbench.action.openSettings');
        throw new UserCancelledError('preDeployFailed|OpenSettings');
    } else {
        context.telemetry.properties.preDeployTaskResponse = 'cancel';
        throw new UserCancelledError('preDeployFailed');
    }
}
