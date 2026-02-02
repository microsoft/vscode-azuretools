/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { testGlobalSetup } from '@microsoft/vscode-azext-utils';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerAppServiceExtensionVariables } from '../src';

export const testWorkspaceRoot: string = path.resolve(__dirname, '..', 'testWorkspace');

// Runs before all tests
suiteSetup(async () => {
    const baseVars = testGlobalSetup();
    const extVars = { ...baseVars, prefix: 'appService' }; // Prefix must match setting prefix in file://./test.code-workspace
    registerAppServiceExtensionVariables(extVars);

    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
        await fse.ensureDir(folder.uri.fsPath);
    }
});
