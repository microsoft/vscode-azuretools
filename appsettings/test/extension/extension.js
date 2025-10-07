/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const vscode = require('vscode');
const ui_1 = require('@microsoft/vscode-azext-utils');

function activate(context) {
    const extVars = {
        context,
        outputChannel: vscode.window.createOutputChannel('azureappsettings')
    };
    ui_1.registerUIExtensionVariables(extVars);
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;
