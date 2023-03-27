/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

// Runs before all tests
suiteSetup(async () => {
    const id: string = 'ms-azuretools.azureextensionui';
    const extension: vscode.Extension<unknown> | undefined = vscode.extensions.getExtension(id);
    if (!extension) {
        throw new Error(`Failed to activate extension with id "${id}".`);
    } else {
        await extension.activate();
    }
});
