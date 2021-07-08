/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const vscode = require('vscode');
const ui_1 = require('vscode-azureextensionui');
const appservice_1 = require('../../out/src/index');

function activate(context) {
    const extVars = {
        context,
        outputChannel: vscode.window.createOutputChannel('azureappservice')
    };
    ui_1.registerUIExtensionVariables(extVars);
    appservice_1.registerAppServiceExtensionVariables(extVars);
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;
