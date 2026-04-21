/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.\w+$/.test(specifier)) {
        for (const ext of ['.ts', '.js']) {
            try {
                return await nextResolve(specifier + ext, context);
            } catch {
                // try next extension
            }
        }
    }

    return nextResolve(specifier, context);
}
