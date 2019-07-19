/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as types from '../../index';

export function getIconPath(iconName: string): types.TreeItemIconPath {
    return path.join(getResourcesPath(), `${iconName}.svg`);
}

export function getThemedIconPath(iconName: string): types.TreeItemIconPath {
    return {
        light: path.join(getResourcesPath(), 'light', `${iconName}.svg`),
        dark: path.join(getResourcesPath(), 'dark', `${iconName}.svg`)
    };
}

function getResourcesPath(): string {
    return path.join(__filename, '..', '..', '..', '..', 'resources');
}
