/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, IAzureQuickPickItem } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import * as vscode from 'vscode';

export async function selectWorkspaceFolder(context: IActionContext, placeHolder: string): Promise<vscode.WorkspaceFolder | vscode.Uri> {
    return await selectWorkspaceItem(
        context,
        placeHolder,
        {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
            openLabel: vscode.l10n.t('Select')
        });
}

export async function selectWorkspaceFile(context: IActionContext, placeHolder: string, fileExtensions?: string[]): Promise<vscode.WorkspaceFolder | vscode.Uri> {
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
            openLabel: vscode.l10n.t('Select'),
            filters: filters
        });
}

export async function selectWorkspaceItem(context: IActionContext, placeHolder: string, options: vscode.OpenDialogOptions): Promise<vscode.WorkspaceFolder | vscode.Uri> {
    let folder: vscode.WorkspaceFolder | undefined;
    if (vscode.workspace.workspaceFolders) {
        const folderPicks: IAzureQuickPickItem<vscode.WorkspaceFolder | undefined>[] = await Promise.all(vscode.workspace.workspaceFolders.map((f: vscode.WorkspaceFolder) => {
            return { label: path.basename(f.uri.fsPath), description: f.uri.fsPath, data: f };
        }));

        folderPicks.push({ label: vscode.l10n.t('$(file-directory) Browse...'), description: '', data: undefined });
        folder = (await context.ui.showQuickPick(folderPicks, { placeHolder })).data;
    }

    if (folder) {
        return folder;
    } else {
        context.telemetry.properties.browse = 'true';
        return (await context.ui.showOpenDialog(options))[0];
    }
}
