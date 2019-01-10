/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { relative } from 'path';

export function isSubpath(expectedParent: string, expectedChild: string): boolean {
    const relativePath: string = relative(expectedParent, expectedChild);
    return relativePath !== '' && !relativePath.startsWith('..') && relativePath !== expectedChild;
}

export function isPathEqual(fsPath1: string, fsPath2: string): boolean {
    const relativePath: string = relative(fsPath1, fsPath2);
    return relativePath === '';
}
