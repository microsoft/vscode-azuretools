/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    try {
        const vscodeExecutablePath = await downloadAndUnzipVSCode();
        const repoRoot: string = path.resolve(__dirname, '..', '..');
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath: path.resolve(repoRoot, 'test', 'extension'),
            launchArgs: [
                path.resolve(repoRoot, 'test', 'test.code-workspace'),
                '--disable-workspace-trust'
            ],
            extensionTestsPath: path.resolve(__dirname, './index'),
            extensionTestsEnv: {
                DEBUGTELEMETRY: 'v'
            }
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

void main();
