/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Has extra logic to remove a BOM character if it exists
 */
export function parseJson<T extends object>(data: string): T {
    return <T>JSON.parse(removeBom(data));
}

export function removeBom(data: string): string {
    return data.charCodeAt(0) === 0xFEFF ? data.slice(1) : data;
}
