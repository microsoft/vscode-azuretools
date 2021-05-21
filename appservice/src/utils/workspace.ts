/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IActionContext, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';

export async function selectWorkspaceFolder(context: IActionContext, placeHolder: string, quickPicks?: IAzureQuickPickItem<string>[]): Promise<string> {
    const defaultQuickPicks: IAzureQuickPickItem<string | undefined>[]|undefined = vscode.workspace.workspaceFolders?.map((f: vscode.WorkspaceFolder) => {
        return { label: path.basename(f.uri.fsPath), description: f.uri.fsPath, data: f.uri.fsPath };
    });
    return await selectWorkspaceItem(
        context,
        placeHolder,
        {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
            openLabel: localize('select', 'Select')
        }, 
        quickPicks??defaultQuickPicks);
}

export async function selectWorkspaceFile(context: IActionContext, placeHolder: string, fileExtensions?: string[], quickPicks?: IAzureQuickPickItem<string>[]): Promise<string> {
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
        quickPicks);
}

export async function selectWorkspaceItem(context: IActionContext, placeHolder: string, options: vscode.OpenDialogOptions, quickPicks?: IAzureQuickPickItem<string | undefined>[]): Promise<string> {
    let picked: IAzureQuickPickItem<string | undefined> | undefined;
    if (quickPicks?.length) {
        const fileOrFolderPick = { label: localize('azFunc.browse', '$(file-directory) Browse...'), description: '', data: undefined };
        picked = await context.ui.showQuickPick([...quickPicks||[], fileOrFolderPick], { placeHolder });
    }

    if (picked?.data) {
        return picked.data;
    } else {
        context.telemetry.properties.browse = 'true';
        return (await context.ui.showOpenDialog(options))[0].fsPath;
    }
}
