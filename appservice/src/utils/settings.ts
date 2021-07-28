/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget, Uri, workspace, WorkspaceConfiguration, WorkspaceFolder } from "vscode";

export async function updateGlobalSetting<T = string>(section: string, value: T, prefix: string): Promise<void> {
    const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix);
    await projectConfiguration.update(section, value, ConfigurationTarget.Global);
}

export async function updateWorkspaceSetting<T = string>(section: string, value: T, fsPath: string | WorkspaceFolder, prefix: string): Promise<void> {
    const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix, getScope(fsPath));
    await projectConfiguration.update(section, value);
}

export function getGlobalSetting<T>(key: string, prefix: string): T | undefined {
    const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix);
    const result: { globalValue?: T } | undefined = projectConfiguration.inspect<T>(key);
    return result && result.globalValue;
}

export function getWorkspaceSetting<T>(key: string, prefix: string, fsPath?: string | WorkspaceFolder): T | undefined {
    const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix, getScope(fsPath));
    return projectConfiguration.get<T>(key);
}

function getScope(fsPath: WorkspaceFolder | string | undefined): Uri | WorkspaceFolder | undefined {
    return typeof fsPath === 'string' ? Uri.file(fsPath) : fsPath;
}

export function getWorkspaceSettingFromAnyFolder(key: string, prefix: string): string | undefined {
    if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
        let result: string | undefined;
        for (const folder of workspace.workspaceFolders) {
            const projectConfiguration: WorkspaceConfiguration = workspace.getConfiguration(prefix, folder.uri);
            const folderResult: string | undefined = projectConfiguration.get<string>(key);
            if (!result) {
                result = folderResult;
            } else if (folderResult && result !== folderResult) {
                return undefined;
            }
        }
        return result;
    } else {
        return getGlobalSetting(key, prefix);
    }
}
