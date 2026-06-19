/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig, type TestConfiguration as VscodeTestConfig } from '@vscode/test-cli';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Base config - shared between different test configs
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const baseConfig: Partial<VscodeTestConfig> = {
    mocha: {
        require: ['tsx'],
        timeout: 10000,
    },
    env: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        VSCODE_RUNNING_TESTS: '1',
        DEBUGTELEMETRY: '1',
    },
};

if (process.platform !== 'win32') {
    // @vscode/test-cli creates an AF_UNIX IPC socket under the user-data dir on macOS/Linux. Deep
    // checkouts and git worktrees can push the default socket path past sockaddr_un.sun_path's
    // 104-character limit, so use a short temp path instead. Windows uses named pipes, so leave it
    // unchanged. Hash process.cwd() so each consuming checkout gets its own stable user-data dir
    // instead of colliding on the shared eng package path, and reuse that deterministic path
    // instead of creating a fresh mkdtemp-style temp directory on every run.
    const checkoutHash = createHash('sha1').update(process.cwd()).digest('hex').slice(0, 8);
    baseConfig.launchArgs = [
        ...(baseConfig.launchArgs ?? []),
        '--user-data-dir',
        join(tmpdir(), `vscode-azure-test-${checkoutHash}`),
    ];
}

/**
 * Test configuration for extensions with tests in `./src/test/` directory.
 * @see https://github.com/microsoft/vscode-test-cli for more options
 */
export const azExtSrcTestConfig = defineConfig({
    ...baseConfig,
    files: 'src/test/**/*.test.{ts,mts,cts}',
    workspaceFolder: 'src/test/test.code-workspace',
});

/**
 * Test configuration for extensions with tests in `./test/` directory.
 * @see https://github.com/microsoft/vscode-test-cli for more options
 */
export const azExtTestConfig = defineConfig({
    ...baseConfig,
    files: 'test/**/*.test.{ts,mts,cts}',
    workspaceFolder: 'test/test.code-workspace',
});
