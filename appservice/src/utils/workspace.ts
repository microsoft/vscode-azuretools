/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IActionContext, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';

export async function selectWorkspaceFolder(context: IActionContext, placeHolder: string, suggestions?: IAzureQuickPickItem<string>[]): Promise<string> {
    return await selectWorkspaceItem(
        context,
        placeHolder,
        {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
            openLabel: localize('select', 'Select')
        }, suggestions);
}

export async function selectWorkspaceFile(context: IActionContext, placeHolder: string, fileExtensions?: string[], suggestions?: IAzureQuickPickItem<string>[]): Promise<string> {
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
        },
        suggestions);
}

export async function selectWorkspaceItem(context: IActionContext, placeHolder: string, options: vscode.OpenDialogOptions,
    suggestions?: IAzureQuickPickItem<string | undefined>[]): Promise<string> {
    let folder: IAzureQuickPickItem<string | undefined> | undefined;
    if (vscode.workspace.workspaceFolders) {
        const defaultSuggestions: IAzureQuickPickItem<string | undefined>[] = await Promise.all(vscode.workspace.workspaceFolders.map((f: vscode.WorkspaceFolder) => {
            return { label: path.basename(f.uri.fsPath), description: f.uri.fsPath, data: f.uri.fsPath };
        }));
        suggestions = suggestions?.length ? suggestions : defaultSuggestions;
        const fileChooser = { label: localize('azFunc.browse', '$(file-directory) Browse...'), description: '', data: undefined };
        folder = await context.ui.showQuickPick([...suggestions, fileChooser], { placeHolder });
    }

    if (folder?.data) {
        return folder.data;
    } else {
        context.telemetry.properties.browse = 'true';
        return (await context.ui.showOpenDialog(options))[0].fsPath;
    }
}
