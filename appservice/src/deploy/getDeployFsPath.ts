/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { AzureParentTreeItem, DialogResponses } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { isPathEqual, isSubpath } from '../utils/fs';
import { getWorkspaceSetting, updateGlobalSetting } from '../utils/settings';
import * as workspaceUtil from '../utils/workspace';

const deploySubpathSetting: string = 'deploySubpath';
/**
 * Entry point can be the workspace folder, the fsPath, or the tree item being deployed to
 * In App Service, users can deploy specific artifact files (such as .jar) which is handled by selectWorkspaceFile
 */

export async function getDeployFsPath(target: vscode.Uri | string | AzureParentTreeItem | undefined, extensionPrefix: string, fileExtensions?: string | string[]): Promise<deployPaths> {
    if (target instanceof vscode.Uri) {
        return { deployFsPath: target.fsPath, deployFsSubpath: await appendDeploySubpathSetting(target.fsPath, extensionPrefix) };
    } else if (typeof target === 'string') {
        return { deployFsPath: target, deployFsSubpath: await appendDeploySubpathSetting(target, extensionPrefix) };
    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
        // If there is only one workspace and it has 'deploySubPath' set - return that value without prompting
        const folderPath: string = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const deploySubpath: string | undefined = getWorkspaceSetting(deploySubpathSetting, extensionPrefix, folderPath);
        if (deploySubpath) {
            return { deployFsPath: folderPath, deployFsSubpath: path.join(folderPath, deploySubpath) };
        }
    }

    if (typeof fileExtensions === 'string') {
        fileExtensions = [fileExtensions];
    }

    const selectFile: string = localize('selectDeployFile', 'Select the {0} file to deploy', fileExtensions ? fileExtensions.join('/') : '');
    const selectFolder: string = localize('selectZipDeployFolder', 'Select the folder to zip and deploy');

    const deployFsPath: string = fileExtensions ?
        await workspaceUtil.selectWorkspaceFile(selectFile, undefined, fileExtensions) :
        await workspaceUtil.selectWorkspaceFolder(selectFolder, undefined);

    return { deployFsPath, deployFsSubpath: await appendDeploySubpathSetting(deployFsPath, extensionPrefix) };
}

/**
 * Appends the deploySubpath setting if the target path matches the root of a workspace folder
 * If the targetPath is a sub folder instead of the root, leave the targetPath as-is and assume they want that exact folder used
 */
async function appendDeploySubpathSetting(targetPath: string, extensionPrefix: string): Promise<string> {
    if (vscode.workspace.workspaceFolders) {
        const deploySubPath: string | undefined = getWorkspaceSetting(deploySubpathSetting, extensionPrefix, targetPath);
        if (deploySubPath) {
            if (vscode.workspace.workspaceFolders.some(f => isPathEqual(f.uri.fsPath, targetPath))) {
                return path.join(targetPath, deploySubPath);
            } else {
                const folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders.find(f => isSubpath(f.uri.fsPath, targetPath));
                if (folder) {
                    const fsPathWithSetting: string = path.join(folder.uri.fsPath, deploySubPath);
                    if (!isPathEqual(fsPathWithSetting, targetPath)) {
                        const settingKey: string = 'showDeploySubpathWarning';
                        // tslint:disable-next-line: strict-boolean-expressions
                        if (getWorkspaceSetting(settingKey, extensionPrefix)) {
                            const selectedFolder: string = path.relative(folder.uri.fsPath, targetPath);
                            const message: string = localize('mismatchDeployPath', 'Deploying "{0}" instead of selected folder "{1}". Use "{2}.{3}" to change this behavior.', deploySubPath, selectedFolder, extensionPrefix, deploySubpathSetting);
                            // don't wait
                            // tslint:disable-next-line:no-floating-promises
                            ext.ui.showWarningMessage(message, { title: localize('ok', 'OK') }, DialogResponses.dontWarnAgain).then(async (result: vscode.MessageItem) => {
                                if (result === DialogResponses.dontWarnAgain) {
                                    await updateGlobalSetting(settingKey, false, extensionPrefix);
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

export type deployPaths = {
    deployFsPath: string,
    deployFsSubpath: string
};
