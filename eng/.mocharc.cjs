/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const { createNodeMochaConfig } = require('@microsoft/vscode-azext-eng/mocha/config');

module.exports = createNodeMochaConfig({
    'node-option': ['disable-warning=ExperimentalWarning'],
});
