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
import { SiteClient } from '../SiteClient';
import { StringDictionary } from 'azure-arm-website/lib/models';
import { formatDeployLog } from './formatDeployLog';

export async function runPreDeployTask(actionContext: IActionContext, deployFsPath: string, scmType: string | undefined, extensionPrefix: string): Promise<void> {
    const preDeployResult: IPreDeployTaskResult = await tryRunPreDeployTask(actionContext, deployFsPath, scmType, extensionPrefix);
    if (preDeployResult.failedToFindTask) {
        throw new Error(`Failed to find pre-deploy task "${preDeployResult.taskName}". Modify your tasks or the setting "${extensionPrefix}.preDeployTask".`);
    } else if (preDeployResult.exitCode !== undefined && preDeployResult.exitCode !== 0) {
        await handleFailedPreDeployTask(actionContext, preDeployResult);
    }
}

export async function tryRunPreDeployTask(actionContext: IActionContext, deployFsPath: string, scmType: string | undefined, extensionPrefix: string): Promise<IPreDeployTaskResult> {
    const preDeployTaskKey: string = 'preDeployTask';
    const taskName: string | undefined = vscode.workspace.getConfiguration(extensionPrefix, vscode.Uri.file(deployFsPath)).get(preDeployTaskKey);
    actionContext.properties.hasPreDeployTask = String(!!taskName);

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
                await vscode.tasks.executeTask(preDeployTask);
                exitCode = await waitForPreDeployTask(preDeployTask);
                actionContext.properties.preDeployTaskExitCode = String(exitCode);
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

export async function handleFailedPreDeployTask(actionContext: IActionContext, preDeployResult: IPreDeployTaskResult): Promise<void> {
    const message: string = localize('taskFailed', 'Pre-deploy task "{0}" failed with exit code "{1}".', preDeployResult.taskName, preDeployResult.exitCode);
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

// prior to git deploying, these settings must be deleted or it will fail
export async function verifyNoRunFromPackageSetting(client: SiteClient): Promise<void> {
    let updateSettings: boolean = false;
    const runFromPackageSettings: string[] = ['WEBSITE_RUN_FROM_PACKAGE', 'WEBSITE_RUN_FROM_ZIP'];
    const applicationSettings: StringDictionary = await client.listApplicationSettings();
    for (const settingName of runFromPackageSettings) {
        if (applicationSettings.properties && applicationSettings.properties[settingName]) {
            delete applicationSettings.properties[settingName];
            ext.outputChannel.appendLine(formatDeployLog(client, localize('deletingSetting', 'Deleting setting "{0}"...', settingName)));
            updateSettings = true;
        }
    }
    if (updateSettings) {
        await client.updateApplicationSettings(applicationSettings);
    }
}
