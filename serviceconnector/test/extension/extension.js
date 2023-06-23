/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const vscode = require('vscode');
const azure_1 = require('@microsoft/vscode-azext-azureutils');

function activate(context) {
    const extVars = {
        context,
        outputChannel: vscode.window.createOutputChannel('azureserviceconnector')
    };
    azure_1.registerAzureUtilsExtensionVariables(extVars);
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;
