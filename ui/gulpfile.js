/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('path');
const cp = require('child_process');

function test() {
    const env = process.env;
    env.DEBUGTELEMETRY = 1;
    env.MOCHA_reporter = 'mocha-junit-reporter';
    env.MOCHA_FILE = path.join(__dirname, 'test-results.xml');
    env.CODE_EXTENSIONS_PATH = path.join(__dirname, 'test', 'extension');
    return cp.spawn('node', ['./node_modules/vscode/bin/test'], { stdio: 'inherit', env });
};

exports.test = test;