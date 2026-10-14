/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Copies configuration objects and arrays without cloning callbacks or class instances. */
export function cloneConfig<T>(value: T): T {
    if (Array.isArray(value)) {
        return (value as unknown[]).map(item => cloneConfig(item)) as T;
    }

    if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        const entries: [string, unknown][] = Object.entries(value);
        return Object.fromEntries(entries.map(([key, item]) => [key, cloneConfig(item)])) as T;
    }

    return value;
}
