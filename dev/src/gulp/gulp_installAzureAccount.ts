/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { gulp_installVSCodeExtension } from './gulp_installVSCodeExtension';

// tslint:disable-next-line: export-name
export async function gulp_installAzureAccount(): Promise<void> {
    return gulp_installVSCodeExtension('ms-vscode', 'azure-account');
}
