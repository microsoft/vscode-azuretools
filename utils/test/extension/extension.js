/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const vscode = require('vscode');
const createAzExtOutputChannel = require('../../dist/cjs/src/AzExtOutputChannel').createAzExtOutputChannel;

const ui_1 = require('../../dist/cjs/src/index');
const DebugReporter = require('../../dist/cjs/src/DebugReporter').DebugReporter;

function activate(context) {
    const extVars = {
        context,
        reporter: new DebugReporter(),
        outputChannel: createAzExtOutputChannel('Extension Test Output', 'azureextensionui')
    };
    ui_1.registerUIExtensionVariables(extVars)
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;
