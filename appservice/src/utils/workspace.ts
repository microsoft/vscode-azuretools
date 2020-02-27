/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IActionContext, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';

export async function selectWorkspaceFolder(context: IActionContext, placeHolder: string): Promise<string> {
    return await selectWorkspaceItem(
        context,
        placeHolder,
        {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
            openLabel: localize('select', 'Select')
        });
}

export async function selectWorkspaceFile(context: IActionContext, placeHolder: string, fileExtensions?: string[]): Promise<string> {
    const filters: { [name: string]: string[] } = {};
    if (fileExtensions) {
        filters.Artifacts = fileExtensions;
    }
    return await selectWorkspaceItem(
        context,
        placeHolder,
        {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: localize('select', 'Select'),
            filters: filters
        });
}

export async function selectWorkspaceItem(context: IActionContext, placeHolder: string, options: vscode.OpenDialogOptions): Promise<string> {
    let folder: IAzureQuickPickItem<string | undefined> | undefined;
    if (vscode.workspace.workspaceFolders) {
        const folderPicks: IAzureQuickPickItem<string | undefined>[] = await Promise.all(vscode.workspace.workspaceFolders.map(async (f: vscode.WorkspaceFolder) => {
            return { label: path.basename(f.uri.fsPath), description: f.uri.fsPath, data: f.uri.fsPath };
        }));

        folderPicks.push({ label: localize('azFunc.browse', '$(file-directory) Browse...'), description: '', data: undefined });
        folder = await ext.ui.showQuickPick(folderPicks, { placeHolder });
    }

    if (folder?.data) {
        return folder.data;
    } else {
        context.telemetry.properties.browse = 'true';
        return (await ext.ui.showOpenDialog(options))[0].fsPath;
    }
}
