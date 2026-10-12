/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResolveFnOutput, ResolveHookContext, ResolveHookSync } from 'node:module';

/**
 * Resolve hook: tries appending '.ts' / '.js' to relative specifiers that lack an extension.
 */
export function resolve(
    specifier: string,
    context: ResolveHookContext,
    nextResolve: Parameters<ResolveHookSync>[2],
): ResolveFnOutput {
    // Preserve normal CommonJS resolution; only adapt extensionless relative ESM imports.
    // Early synchronous hooks supply conditions as a Set rather than an array.
    if (!Array.from(context.conditions).includes('require') && specifier.startsWith('.') && !/\.\w+$/.test(specifier)) {
        for (const ext of ['.ts', '.js']) {
            try {
                return nextResolve(specifier + ext, context);
            } catch (e) {
                if ((e as NodeJS.ErrnoException | undefined)?.code !== 'ERR_MODULE_NOT_FOUND') {
                    throw e;
                }
            }
        }
    }

    return nextResolve(specifier, context);
}
