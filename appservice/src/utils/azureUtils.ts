
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line: export-name
export function areLocationNamesEqual(name1: string | undefined, name2: string | undefined): boolean {
    return normalizeLocationName(name1) === normalizeLocationName(name2);
}

function normalizeLocationName(name: string | undefined): string {
    // tslint:disable-next-line:strict-boolean-expressions
    return (name || '').toLowerCase().replace(/\s/g, '');
}
