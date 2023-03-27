/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * `Array.includes()` but caseless
 *
 * @param arr The array to search in
 * @param value The value to search for
 *
 * @returns True if the array contains a value that is equal to the given value, ignoring case
 */
export function caselessIncludes(arr: string[], value: string): boolean {
    return arr.some((v) => v.toLowerCase() === value.toLowerCase());
}
