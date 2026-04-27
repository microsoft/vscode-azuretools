/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { autoEsbuildOrWatch, autoSelectEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';
const config = autoSelectEsbuildConfig(false, false);
config.extensionConfig.entryPoints = [{ in: './src/index.ts', out: 'extension.bundle' }];
delete config.extensionConfig.alias;
await autoEsbuildOrWatch(config);
