/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, callWithTelemetryAndErrorHandling, DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
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
    if (target instanceof vscode.Uri) {
        originalDeployFsPath = target.fsPath;
        effectiveDeployFsPath = await appendDeploySubpathSetting(context, target.fsPath);
    } else if (typeof target === 'string') {
        originalDeployFsPath = target;
        effectiveDeployFsPath = await appendDeploySubpathSetting(context, target);
    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
        // If there is only one workspace and it has 'deploySubPath' set - return that value without prompting
        const folderPath: string = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const deploySubpath: string | undefined = getWorkspaceSetting(deploySubpathSetting, ext.prefix, folderPath);
        if (deploySubpath) {
            context.telemetry.properties.hasDeploySubpathSetting = 'true';
            originalDeployFsPath = folderPath;
            effectiveDeployFsPath = path.join(folderPath, deploySubpath);
        }
    }

    if (!originalDeployFsPath || !effectiveDeployFsPath) {
        if (typeof fileExtensions === 'string') {
            fileExtensions = [fileExtensions];
        }

        const selectFile: string = localize('selectDeployFile', 'Select the {0} file to deploy', fileExtensions ? fileExtensions.join('/') : '');
        const selectFolder: string = localize('selectDeployFolder', 'Select the folder to deploy');

        originalDeployFsPath = fileExtensions ?
            await workspaceUtil.selectWorkspaceFile(context, selectFile, fileExtensions) :
            await workspaceUtil.selectWorkspaceFolder(context, selectFolder);
        effectiveDeployFsPath = await appendDeploySubpathSetting(context, originalDeployFsPath);
    }

    void addRuntimeFileTelemetry(context, effectiveDeployFsPath);

    const workspaceFolder: vscode.WorkspaceFolder = getContainingWorkspace(context, effectiveDeployFsPath);
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
async function appendDeploySubpathSetting(context: IActionContext, targetPath: string): Promise<string> {
    if (vscode.workspace.workspaceFolders) {
        const deploySubPath: string | undefined = getWorkspaceSetting(deploySubpathSetting, ext.prefix, targetPath);
        if (deploySubPath) {
            context.telemetry.properties.hasDeploySubpathSetting = 'true';

            if (vscode.workspace.workspaceFolders.some(f => isPathEqual(f.uri.fsPath, targetPath))) {
                return path.join(targetPath, deploySubPath);
            } else {
                const folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders.find(f => isSubpath(f.uri.fsPath, targetPath));
                if (folder) {
                    const fsPathWithSetting: string = path.join(folder.uri.fsPath, deploySubPath);
                    if (!isPathEqual(fsPathWithSetting, targetPath)) {
                        context.telemetry.properties.overwriteTargetWithSubpathSetting = 'true';

                        const settingKey: string = 'showDeploySubpathWarning';
                        if (getWorkspaceSetting(settingKey, ext.prefix)) {
                            const selectedFolder: string = path.relative(folder.uri.fsPath, targetPath);
                            const message: string = localize('mismatchDeployPath', 'Deploying "{0}" instead of selected folder "{1}". Use "{2}.{3}" to change this behavior.', deploySubPath, selectedFolder, ext.prefix, deploySubpathSetting);
                            // don't wait
                            void context.ui.showWarningMessage(message, { title: localize('ok', 'OK') }, DialogResponses.dontWarnAgain).then(async (result: vscode.MessageItem) => {
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

function getContainingWorkspace(context: IActionContext, fsPath: string): vscode.WorkspaceFolder {
    const openFolders: readonly vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders || [];
    const workspaceFolder: vscode.WorkspaceFolder | undefined = openFolders.find((f: vscode.WorkspaceFolder): boolean => {
        return isPathEqual(f.uri.fsPath, fsPath) || isSubpath(f.uri.fsPath, fsPath);
    });

    if (!workspaceFolder) {
        const openInNewWindow: vscode.MessageItem = { title: localize('openInNewWindow', 'Open in new window') };
        const message: string = localize('folderOpenWarning', 'Failed to deploy because "{0}" is not part of an open workspace.', path.basename(fsPath));

        // don't wait
        void context.ui.showWarningMessage(message, openInNewWindow).then(async result => {
            await callWithTelemetryAndErrorHandling('deployWarning.openInNewWindow', async (postDeployContext: IActionContext) => {
                postDeployContext.telemetry.properties.dialogResult = result?.title;
                if (result === openInNewWindow) {
                    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(fsPath), true /* forceNewWindow */);
                }
            });
        });

        throw new UserCancelledError('openInNewWindow');
    }

    context.telemetry.properties.deployingSubpathOfWorkspace = String(isSubpath(workspaceFolder.uri.fsPath, fsPath));
    return workspaceFolder;
}
