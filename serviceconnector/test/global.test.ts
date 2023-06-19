/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

export const testWorkspaceRoot: string = path.resolve(__dirname, '..', '..', 'testWorkspace');

// Runs before all tests
suiteSetup(async () => {
    const id: string = 'ms-azuretools.azureappservice';
    const extension: vscode.Extension<unknown> | undefined = vscode.extensions.getExtension(id);
    if (!extension) {
        throw new Error(`Failed to activate extension with id "${id}".`);
    } else {
        await extension.activate();
    }

    const folders = vscode.workspace.workspaceFolders || [];
    for (const folder of folders) {
        await fse.ensureDir(folder.uri.fsPath);
    }
});
