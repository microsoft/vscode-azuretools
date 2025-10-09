/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig, type TestConfiguration } from '@vscode/test-cli';

/**
 * Base config - shared between different test configs
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const baseConfig: Partial<TestConfiguration> = {
    mocha: {
        require: ['tsx'],
        timeout: 10000,
    },
};

/**
 * Default `./src/test` config for Azure extensions for VS Code.
 * @see https://github.com/microsoft/vscode-test-cli for more options
 */
export const azExtSrcTestConfig = defineConfig({
    ...baseConfig,
    files: 'src/test/**/*.test.{ts,mts,cts}',
    workspaceFolder: 'src/test/test.code-workspace',
});

/**
 * Default `./test` config for Azure extensions for VS Code.
 * @see https://github.com/microsoft/vscode-test-cli for more options
 */
export const azExtTestConfig = defineConfig({
    ...baseConfig,
    files: 'test/**/*.test.{ts,mts,cts}',
    workspaceFolder: 'test/test.code-workspace',
});
