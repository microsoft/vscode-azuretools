/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ScmType } from '../ScmType';
import { isPathEqual, isSubpath } from '../utils/pathUtils';

export async function runPreDeployTask(context: IActionContext, deployFsPath: string, scmType: string | undefined, extensionPrefix: string): Promise<void> {
    const preDeployResult: IPreDeployTaskResult = await tryRunPreDeployTask(context, deployFsPath, scmType, extensionPrefix);
    if (preDeployResult.failedToFindTask) {
        throw new Error(`Failed to find pre-deploy task "${preDeployResult.taskName}". Modify your tasks or the setting "${extensionPrefix}.preDeployTask".`);
    } else if (preDeployResult.exitCode !== undefined && preDeployResult.exitCode !== 0) {
        await handleFailedPreDeployTask(context, preDeployResult);
    }
}

export async function tryRunPreDeployTask(context: IActionContext, deployFsPath: string, scmType: string | undefined, extensionPrefix: string): Promise<IPreDeployTaskResult> {
    const preDeployTaskKey: string = 'preDeployTask';
    const taskName: string | undefined = vscode.workspace.getConfiguration(extensionPrefix, vscode.Uri.file(deployFsPath)).get(preDeployTaskKey);
    context.telemetry.properties.hasPreDeployTask = String(!!taskName);

    let failedToFindTask: boolean = false;
    let exitCode: number | undefined;
    if (taskName) {
        if (scmType === ScmType.LocalGit || scmType === ScmType.GitHub) {
            // We don't run pre deploy tasks for non-zipdeploy since that stuff should be handled by kudu
            ext.outputChannel.appendLine(localize('ignoringPreDeployTask', 'WARNING: Ignoring preDeployTask "{0}" for non-zip deploy.', taskName));
        } else {
            const tasks: vscode.Task[] = await vscode.tasks.fetchTasks();
            const preDeployTask: vscode.Task | undefined = tasks.find((task: vscode.Task) => isTaskEqual(taskName, deployFsPath, task));
            if (preDeployTask) {
                const progressMessage: string = localize('runningTask', 'Running preDeployTask "{0}"...', taskName);
                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: progressMessage }, async () => {
                    await vscode.tasks.executeTask(preDeployTask);
                    exitCode = await waitForPreDeployTask(preDeployTask);
                    context.telemetry.properties.preDeployTaskExitCode = String(exitCode);
                });
            } else {
                failedToFindTask = true;
            }
        }
    }

    return {
        failedToFindTask,
        exitCode,
        taskName
    };
}

export interface IPreDeployTaskResult {
    taskName: string | undefined;
    exitCode: number | undefined;
    failedToFindTask: boolean;
}

function isTaskEqual(expectedName: string, expectedPath: string, actualTask: vscode.Task): boolean {
    // This regexp matches the name and optionally allows the source as a prefix
    // Example with no prefix: "build"
    // Example with prefix: "func: extensions install"
    const regexp: RegExp = new RegExp(`^(${actualTask.source}: )?${actualTask.name}$`, 'i');
    if (regexp.test(expectedName) && actualTask.scope !== undefined) {
        const workspaceFolder: Partial<vscode.WorkspaceFolder> = <Partial<vscode.WorkspaceFolder>>actualTask.scope;
        return !!workspaceFolder.uri && (isPathEqual(workspaceFolder.uri.fsPath, expectedPath) || isSubpath(workspaceFolder.uri.fsPath, expectedPath));
    } else {
        return false;
    }
}

async function waitForPreDeployTask(preDeployTask: vscode.Task): Promise<number> {
    return await new Promise((resolve: (exitCode: number) => void): void => {
        const listener: vscode.Disposable = vscode.tasks.onDidEndTaskProcess((e: vscode.TaskProcessEndEvent) => {
            if (e.execution.task === preDeployTask) {
                listener.dispose();
                resolve(e.exitCode);
            }
        });
    });
}

export async function handleFailedPreDeployTask(context: IActionContext, preDeployResult: IPreDeployTaskResult): Promise<void> {
    const message: string = localize('taskFailed', 'Errors exist after running preDeployTask "{0}". See task output for more info.', preDeployResult.taskName);
    const deployAnyway: vscode.MessageItem = { title: localize('deployAnyway', 'Deploy Anyway') };
    const openSettings: vscode.MessageItem = { title: localize('openSettings', 'Open Settings') };
    const result: vscode.MessageItem | undefined = await vscode.window.showErrorMessage(message, { modal: true }, deployAnyway, openSettings);
    if (result === deployAnyway) {
        context.telemetry.properties.preDeployTaskResponse = 'deployAnyway';
    } else if (result === openSettings) {
        context.telemetry.properties.preDeployTaskResponse = 'openSettings';
        await vscode.commands.executeCommand('workbench.action.openSettings');
        throw new UserCancelledError();
    } else {
        context.telemetry.properties.preDeployTaskResponse = 'cancel';
        throw new UserCancelledError();
    }
}
