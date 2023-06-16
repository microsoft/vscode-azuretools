/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, callWithTelemetryAndErrorHandling, DialogResponses, IActionContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { ext } from '../extensionVariables';
import { isPathEqual, isSubpath } from '../utils/pathUtils';
import { getWorkspaceSetting, updateGlobalSetting } from '../utils/settings';
import * as workspaceUtil from '../utils/workspace';

const deploySubpathSetting: string = 'deploySubpath';

/**
 * Entry point can be the workspace folder, the fsPath, or the tree item being deployed to
 * In App Service, users can deploy specific artifact files (such as .jar) which is handled by selectWorkspaceFile
 * This enforces that the `effectiveDeployFsPath` is currently open in a workspace
 */
export async function getDeployFsPath(context: IActionContext, target: vscode.Uri | string | AzExtTreeItem | undefined, fileExtensions?: string | string[]): Promise<IDeployPaths> {
    let originalDeployFsPath: string | undefined;
    let effectiveDeployFsPath: string | undefined;
    let workspaceFolder: vscode.WorkspaceFolder | undefined;
    if (target instanceof vscode.Uri) {
        originalDeployFsPath = target.fsPath;
        workspaceFolder = vscode.workspace.getWorkspaceFolder(target);
        effectiveDeployFsPath = await appendDeploySubpathSetting(context, workspaceFolder, target.fsPath);
    } else if (typeof target === 'string') {
        originalDeployFsPath = target;
        workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(target));
        effectiveDeployFsPath = await appendDeploySubpathSetting(context, workspaceFolder, target);
    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
        // If there is only one workspace and it has 'deploySubPath' set - return that value without prompting
        const singleWorkspace = vscode.workspace.workspaceFolders[0];
        const deploySubpath: string | undefined = getWorkspaceSetting(deploySubpathSetting, ext.prefix, singleWorkspace);
        if (deploySubpath) {
            context.telemetry.properties.hasDeploySubpathSetting = 'true';
            originalDeployFsPath = singleWorkspace.uri.fsPath;
            effectiveDeployFsPath = path.join(singleWorkspace.uri.fsPath, deploySubpath);
            workspaceFolder = singleWorkspace;
        }
    }

    if (!originalDeployFsPath || !effectiveDeployFsPath) {
        if (typeof fileExtensions === 'string') {
            fileExtensions = [fileExtensions];
        }

        const selectFile: string = vscode.l10n.t('Select the {0} file to deploy', fileExtensions ? fileExtensions.join('/') : '');
        const selectFolder: string = vscode.l10n.t('Select the folder to deploy');

        const selectedItem = fileExtensions ?
            await workspaceUtil.selectWorkspaceFile(context, selectFile, fileExtensions) :
            await workspaceUtil.selectWorkspaceFolder(context, selectFolder);
        if (selectedItem instanceof vscode.Uri) {
            originalDeployFsPath = selectedItem.fsPath;
            workspaceFolder = vscode.workspace.getWorkspaceFolder(selectedItem);
        } else {
            originalDeployFsPath = selectedItem.uri.fsPath;
            workspaceFolder = selectedItem;
        }

        effectiveDeployFsPath = await appendDeploySubpathSetting(context, workspaceFolder, originalDeployFsPath);
    }

    void addRuntimeFileTelemetry(context, effectiveDeployFsPath);

    if (!workspaceFolder) {
        promptToOpenWorkspace(context, originalDeployFsPath);
    }

    context.telemetry.properties.deployingSubpathOfWorkspace = String(isSubpath(workspaceFolder.uri.fsPath, effectiveDeployFsPath));
    return { originalDeployFsPath, effectiveDeployFsPath, workspaceFolder };
}

async function addRuntimeFileTelemetry(context: IActionContext, effectiveDeployFsPath: string): Promise<void> {
    const runtimeFiles: string[] = [];

    const tasks: Promise<void>[] = [
        ...['package.json', 'requirements.txt', 'pom.xml'].map(f => checkRuntimeFile(runtimeFiles, effectiveDeployFsPath, f)),
        ...['dll', 'jar', 'war', 'csproj', 'fsproj'].map(e => checkRuntimeExtension(runtimeFiles, effectiveDeployFsPath, e))
    ];
    await Promise.all(tasks);

    context.telemetry.properties.runtimeFiles = runtimeFiles.sort().join('|');
}

async function checkRuntimeFile(runtimeFiles: string[], effectiveDeployFsPath: string, fileName: string): Promise<void> {
    if (await fse.pathExists(path.join(effectiveDeployFsPath, fileName))) {
        runtimeFiles.push(fileName);
    }
}

async function checkRuntimeExtension(runtimeFiles: string[], effectiveDeployFsPath: string, extension: string): Promise<void> {
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(effectiveDeployFsPath, `*.${extension}`), undefined, 1 /* maxResults */);
    if (files.length > 0) {
        runtimeFiles.push(extension);
    }
}

/**
 * Appends the deploySubpath setting if the target path matches the root of a workspace folder
 * If the targetPath is a sub folder instead of the root, overwrites with the subpath setting and warns the user
 */
async function appendDeploySubpathSetting(context: IActionContext, workspaceFolder: vscode.WorkspaceFolder | undefined, targetPath: string): Promise<string> {
    if (workspaceFolder) {
        const deploySubPath: string | undefined = getWorkspaceSetting(deploySubpathSetting, ext.prefix, workspaceFolder);
        if (deploySubPath) {
            context.telemetry.properties.hasDeploySubpathSetting = 'true';

            if (isPathEqual(workspaceFolder.uri.fsPath, targetPath)) {
                return path.join(targetPath, deploySubPath);
            } else {
                const fsPathWithSetting: string = path.join(workspaceFolder.uri.fsPath, deploySubPath);
                if (!isPathEqual(fsPathWithSetting, targetPath)) {
                    context.telemetry.properties.overwriteTargetWithSubpathSetting = 'true';

                    const settingKey: string = 'showDeploySubpathWarning';
                    if (getWorkspaceSetting(settingKey, ext.prefix)) {
                        const selectedFolder: string = path.relative(workspaceFolder.uri.fsPath, targetPath);
                        const message: string = vscode.l10n.t('Deploying "{0}" instead of selected folder "{1}". Use "{2}.{3}" to change this behavior.', deploySubPath, selectedFolder, ext.prefix, deploySubpathSetting);
                        // don't wait
                        void context.ui.showWarningMessage(message, { title: vscode.l10n.t('OK') }, DialogResponses.dontWarnAgain).then(async (result: vscode.MessageItem) => {
                            if (result === DialogResponses.dontWarnAgain) {
                                await updateGlobalSetting(settingKey, false, ext.prefix);
                            }
                        });
                    }
                }

                return fsPathWithSetting;
            }
        }
    }

    return targetPath;
}

export type IDeployPaths = {
    // the deploy path that the user actually deployed via the extension
    originalDeployFsPath: string,
    // the deploy path after the deploySubpath setting has been appended
    effectiveDeployFsPath: string,
    // the workspace folder containing `effectiveDeployFsPath`
    workspaceFolder: vscode.WorkspaceFolder
};

function promptToOpenWorkspace(context: IActionContext, originalDeployFsPath: string): never {
    const openInNewWindow: vscode.MessageItem = { title: vscode.l10n.t('Open in new window') };
    const message: string = vscode.l10n.t('Failed to deploy because "{0}" is not part of an open workspace.', path.basename(originalDeployFsPath));

    // don't wait
    void context.ui.showWarningMessage(message, openInNewWindow).then(async result => {
        await callWithTelemetryAndErrorHandling('deployWarning.openInNewWindow', async (postDeployContext: IActionContext) => {
            postDeployContext.telemetry.properties.dialogResult = result?.title;
            if (result === openInNewWindow) {
                await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(originalDeployFsPath), true /* forceNewWindow */);
            }
        });
    });

    throw new UserCancelledError('openInNewWindow');
}
