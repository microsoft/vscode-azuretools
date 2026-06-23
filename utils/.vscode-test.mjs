/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { resolve } from 'node:path';
import { azExtTestConfig } from '@microsoft/vscode-azext-eng/vscode-test';

// Share a single VS Code download across all workspace packages
export default { ...azExtTestConfig, cachePath: resolve(import.meta.dirname, '..', '.vscode-test') };
