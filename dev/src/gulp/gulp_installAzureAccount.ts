/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Stream } from 'stream';
import { gulp_installVSCodeExtension } from './gulp_installVSCodeExtension';

export function gulp_installAzureAccount(): Promise<void> | Stream {
    return gulp_installVSCodeExtension('0.8.4', 'ms-vscode', 'azure-account');
}
