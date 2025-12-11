/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig, type TestConfiguration as VscodeTestConfig } from '@vscode/test-cli';

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
