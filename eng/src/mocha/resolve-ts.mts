/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResolveFnOutput, ResolveHookContext, ResolveHookSync } from 'node:module';

/**
 * Resolves extensionless relative ESM imports and missing JavaScript paths against TypeScript sources.
 */
export function resolve(
    specifier: string,
    context: ResolveHookContext,
    nextResolve: Parameters<ResolveHookSync>[2],
): ResolveFnOutput {
    // Preserve normal CommonJS resolution; only adapt relative ESM imports.
    // Early synchronous hooks supply conditions as a Set rather than an array.
    if (!Array.from(context.conditions).includes('require') && specifier.startsWith('.')) {
        const candidates = !/\.\w+$/.test(specifier)
            ? [`${specifier}.ts`, `${specifier}.js`]
            : /\.[cm]?js$/.test(specifier) ? [specifier, specifier.replace(/js$/, 'ts')] : [];
        let originalError: Error | undefined;
        for (const candidate of candidates) {
            try {
                return nextResolve(candidate, context);
            } catch (e) {
                if (!(e instanceof Error) || !('code' in e) || e.code !== 'ERR_MODULE_NOT_FOUND') {
                    throw e;
                }
                if (candidate === specifier) {
                    originalError = e;
                }
            }
        }
        if (originalError !== undefined) {
            throw originalError;
        }
    }

    return nextResolve(specifier, context);
}
