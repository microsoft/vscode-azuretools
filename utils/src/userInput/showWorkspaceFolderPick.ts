/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WorkspaceFolder, WorkspaceFolderPickOptions, l10n, window } from "vscode";
import { UserCancelledError } from "../errors";

export async function showWorkspaceFolderPick(options?: WorkspaceFolderPickOptions): Promise<WorkspaceFolder> {
    const folder: WorkspaceFolder | undefined = await window.showWorkspaceFolderPick({
        ...options,
        placeHolder: options?.placeHolder ?? l10n.t('Select a workspace folder')
    });

    if (!folder) {
        throw new UserCancelledError('selectWorkspaceFolder');
    }

    return folder;
}
