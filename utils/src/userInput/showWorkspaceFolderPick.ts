/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WorkspaceFolder, WorkspaceFolderPickOptions, l10n, window } from "vscode";
import { UserCancelledError } from "../errors";
import type { IActionContext } from '../../index';
import { recordWorkflowUserDismissal, startWorkflowUserWait } from '../workflowTelemetry';

export async function showWorkspaceFolderPick(options?: WorkspaceFolderPickOptions, context?: IActionContext): Promise<WorkspaceFolder> {
    const timer = context && startWorkflowUserWait(context);
    let folder: WorkspaceFolder | undefined;
    try {
        folder = await window.showWorkspaceFolderPick({
            ...options,
            placeHolder: options?.placeHolder ?? l10n.t('Select a workspace folder')
        });
    } finally {
        timer?.dispose();
    }

    if (!folder) {
        if (context) {
            recordWorkflowUserDismissal(context);
        }
        throw new UserCancelledError('selectWorkspaceFolder');
    }

    return folder;
}
