/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IActionContext, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';

export async function selectWorkspaceFolder(context: IActionContext, placeHolder: string, options?: string[]): Promise<string> {
    const picks: IAzureQuickPickItem<string>[] = options ? options.map(folderOption => { return { label: path.basename(folderOption), description: folderOption, data: folderOption } }) : await getWorkspaceFolderPicks();
    return await selectWorkspaceItem(
        context,
        placeHolder,
        {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
            openLabel: localize('select', 'Select')
        }, picks);
}

async function getWorkspaceFolderPicks(): Promise<IAzureQuickPickItem<string>[]> {
    if (vscode.workspace.workspaceFolders) {
        return Promise.all(vscode.workspace.workspaceFolders.map((f: vscode.WorkspaceFolder) => {
            return { label: path.basename(f.uri.fsPath), description: f.uri.fsPath, data: f.uri.fsPath };
        }));
    }
    return Promise.resolve([]);
}

export async function selectWorkspaceFile(context: IActionContext, placeHolder: string, fileExtensions?: string[], options?: string[]): Promise<string> {
    const filters: { [name: string]: string[] } = {};
    if (fileExtensions) {
        filters.Artifacts = fileExtensions;
    }
    const picks: IAzureQuickPickItem<string>[] = options ? options.map(fileOption => { return { label: path.basename(fileOption), description: fileOption, data: fileOption } }) : [];
    return await selectWorkspaceItem(
        context,
        placeHolder,
        {
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: localize('select', 'Select'),
            defaultUri: options && options.length > 0 ? vscode.Uri.file(path.dirname(options[0])) : undefined,
            filters: filters
        }, picks);
}

export async function selectWorkspaceItem(context: IActionContext, placeHolder: string, options: vscode.OpenDialogOptions, picks?: IAzureQuickPickItem<string | undefined>[]): Promise<string> {
    let folder: IAzureQuickPickItem<string | undefined> | undefined;
    if (vscode.workspace.workspaceFolders) {
        const folderPicks: IAzureQuickPickItem<string | undefined>[] = picks ? picks : [];
        folderPicks.push({ label: localize('azFunc.browse', '$(file-directory) Browse...'), description: '', data: undefined });
        folder = await context.ui.showQuickPick(folderPicks, { placeHolder });
    }

    if (folder?.data) {
        return folder.data;
    } else {
        context.telemetry.properties.browse = 'true';
        return (await context.ui.showOpenDialog(options))[0].fsPath;
    }
}
