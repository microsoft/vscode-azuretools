/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResolveHook } from 'node:module';

/**
 * Resolve hook: tries appending '.ts' / '.js' to relative specifiers that lack an extension.
 */
export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
    // Only handle relative imports without a file extension
    if (specifier.startsWith('.') && !/\.\w+$/.test(specifier)) {
        for (const ext of ['.ts', '.js']) {
            try {
                return await nextResolve(specifier + ext, context);
            } catch (e) {
                if ((e as NodeJS.ErrnoException | undefined)?.code !== 'ERR_MODULE_NOT_FOUND') {
                    throw e;
                }
            }
        }
    }

    return nextResolve(specifier, context);
};
