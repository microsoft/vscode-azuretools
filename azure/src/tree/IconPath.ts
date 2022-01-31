/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import type { TreeItemIconPath } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';

export function getIconPath(iconName: string): TreeItemIconPath {
    return path.join(getResourcesPath(), `${iconName}.svg`);
}

function getResourcesPath(): string {
    return ext.ignoreBundle ?
        path.join(__dirname, '..', '..', '..', 'resources') :
        path.join(__dirname, 'node_modules', 'vscode-azureextensionui', 'resources');
}
