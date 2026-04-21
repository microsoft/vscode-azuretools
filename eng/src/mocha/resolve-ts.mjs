/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Resolve hook: tries appending '.ts' / '.js' to relative specifiers that lack an extension.
 *
 * @type {import('node:module').ResolveHook}
 */
export async function resolve(specifier, context, nextResolve) {
    // Only handle relative imports without a file extension
    if (specifier.startsWith('.') && !/\.\w+$/.test(specifier)) {
        for (const ext of ['.ts', '.js']) {
            try {
                return await nextResolve(specifier + ext, context);
            } catch (e) {
                if (e?.code !== 'ERR_MODULE_NOT_FOUND') {
                    throw e;
                }
            }
        }
    }

    return nextResolve(specifier, context);
}
