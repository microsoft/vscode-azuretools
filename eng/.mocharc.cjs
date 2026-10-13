/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const { createNodeMochaConfig } = require('@microsoft/vscode-azext-eng/mocha/config');

module.exports = createNodeMochaConfig({
    // Remove on upgrading to Node 24 once the shared loader no longer emits experimental warnings.
    'node-option': ['disable-warning=ExperimentalWarning'],
});
