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

export async function runPreDeployTask(actionContext: IActionContext, deployFsPath: string, scmType: string | undefined, extensionPrefix: string): Promise<IPreDeployTaskResult> {
    const preDeployTaskKey: string = 'preDeployTask';
    const taskName: string | undefined = vscode.workspace.getConfiguration(extensionPrefix, vscode.Uri.file(deployFsPath)).get(preDeployTaskKey);
    actionContext.properties.hasPreDeployTask = String(!!taskName);

    let failedToFindTask: boolean = false;
    if (taskName) {
        if (scmType === ScmType.LocalGit || scmType === ScmType.GitHub) {
            // We don't run pre deploy tasks for non-zipdeploy since that stuff should be handled by kudu
            ext.outputChannel.appendLine(localize('ignoringPreDeployTask', 'WARNING: Ignoring preDeployTask "{0}" for non-zip deploy.', taskName));
        } else {
            const tasks: vscode.Task[] = await vscode.tasks.fetchTasks();
            const preDeployTask: vscode.Task | undefined = tasks.find((task: vscode.Task) => isTaskEqual(taskName, deployFsPath, task));
            if (preDeployTask) {
                await vscode.tasks.executeTask(preDeployTask);
                await waitForPreDeployTask(preDeployTask, actionContext);
            } else {
                failedToFindTask = true;
                throw new Error(`Failed to find pre-deploy task "${taskName}". Modify your tasks or the setting "${extensionPrefix}.${preDeployTaskKey}".`);
            }
        }
    }

    return {
        failedToFindTask,
        taskName
    };
}

export interface IPreDeployTaskResult {
    taskName: string | undefined;
    failedToFindTask: boolean;
}

function isTaskEqual(expectedName: string, expectedPath: string, actualTask: vscode.Task): boolean {
    if (actualTask.name && actualTask.name.toLowerCase() === expectedName.toLowerCase() && actualTask.scope !== undefined) {
        const workspaceFolder: Partial<vscode.WorkspaceFolder> = <Partial<vscode.WorkspaceFolder>>actualTask.scope;
        return !!workspaceFolder.uri && (isPathEqual(workspaceFolder.uri.fsPath, expectedPath) || isSubpath(workspaceFolder.uri.fsPath, expectedPath));
    } else {
        return false;
    }
}

async function waitForPreDeployTask(preDeployTask: vscode.Task, actionContext: IActionContext): Promise<void> {
    const exitCode: number = await new Promise((resolve: (exitCode: number) => void): void => {
        const listener: vscode.Disposable = vscode.tasks.onDidEndTaskProcess((e: vscode.TaskProcessEndEvent) => {
            if (e.execution.task === preDeployTask) {
                listener.dispose();
                resolve(e.exitCode);
            }
        });
    });

    actionContext.properties.preDeployTaskExitCode = String(exitCode);
    if (exitCode !== 0) {
        const message: string = localize('taskFailed', 'Pre-deploy task "{0}" failed with exit code "{1}".', preDeployTask.name, exitCode);
        const deployAnyway: vscode.MessageItem = { title: localize('deployAnyway', 'Deploy Anyway') };
        const openSettings: vscode.MessageItem = { title: localize('openSettings', 'Open Settings') };
        const result: vscode.MessageItem | undefined = await vscode.window.showErrorMessage(message, { modal: true }, deployAnyway, openSettings);
        if (result === deployAnyway) {
            actionContext.properties.preDeployTaskResponse = 'deployAnyway';
        } else if (result === openSettings) {
            actionContext.properties.preDeployTaskResponse = 'openSettings';
            await vscode.commands.executeCommand('workbench.action.openSettings');
            throw new UserCancelledError();
        } else {
            actionContext.properties.preDeployTaskResponse = 'cancel';
            throw new UserCancelledError();
        }
    }
}
