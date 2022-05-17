/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const vscode = require('vscode');
const azure = require('../../out/src/index');

function activate(context) {
    const extVars = {
        context,
        outputChannel: vscode.window.createOutputChannel('azure')
    };
    azure.registerAzureUtilsExtensionVariables(extVars)
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;
