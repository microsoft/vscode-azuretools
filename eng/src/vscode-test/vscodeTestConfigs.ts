/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { defineConfig } from '@vscode/test-cli';

/**
 * Default test config for Azure extensions for VS Code.
 * @see https://github.com/microsoft/vscode-test-cli for more options
 */
export const azExtTestConfig = defineConfig({
    files: 'src/test/**/*.test.{ts,mts,cts}',
    mocha: {
        // TODO: import: ['tsx'],
        timeout: 10000,
    },
});
