/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * @important When updating these configs, be sure to update the corresponding webpack configs in file://./../webpack/webpackConfigs.ts
 */

import type { BuildOptions } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';

/**
 * Base config - shared between prod/dev/debug
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const baseEsbuildConfig: BuildOptions = {
    bundle: true,
    external: ['vscode'],
    outdir: './dist',
    platform: 'node',
    target: 'es2022',
    keepNames: true,
    entryPoints: [{
        in: './src/extension.ts',
        out: 'extension.bundle',
    }],
    format: 'cjs',
    plugins: [
        copy({
            assets: [
                {
                    from: './node_modules/@microsoft/vscode-azext-azureutils/resources/*.svg',
                    to: './node_modules/@microsoft/vscode-azext-azureutils/resources',
                },
            ],
        }),
    ],
};

/**
 * Production config - minified, no sourcemap
 */
export const azExtEsbuildConfigProd: BuildOptions = {
    ...baseEsbuildConfig,
    minify: true,
    sourcemap: false,
};

/**
 * ESM production config - minified, no sourcemap
 */
export const azExtEsbuildConfigProdEsm: BuildOptions = {
    ...azExtEsbuildConfigProd,
    format: 'esm',
    splitting: true,
};

/**
 * Dev config - not minified, linked sourcemap, watch plugin added
 */
export const azExtEsbuildConfigDev: BuildOptions = {
    ...baseEsbuildConfig,
    minify: false,
    sourcemap: 'linked',
    plugins: [
        ...baseEsbuildConfig.plugins ?? [],
        {
            name: 'watch-plugin',
            setup(build) {
                build.onStart(() => console.log('[watch] build started'));
                build.onEnd(() => console.log('[watch] build finished'));
            },
        },
    ],
};

/**
 * ESM dev config - not minified, linked sourcemap, watch plugin added
 */
export const azExtEsbuildConfigDevEsm: BuildOptions = {
    ...azExtEsbuildConfigDev,
    format: 'esm',
    splitting: true,
};

/**
 * Debug config - minified, no sourcemap, with metafile
 * @note To use the metafile, it also needs to be written to disk. See https://esbuild.github.io/api/#metafile
 */
export const azExtEsbuildConfigDebug: BuildOptions = {
    ...azExtEsbuildConfigProd,
    metafile: true,
};

/**
 * ESM debug config - minified, no sourcemap, with metafile
 * @note To use the metafile, it also needs to be written to disk. See https://esbuild.github.io/api/#metafile
 */
export const azExtEsbuildConfigDebugEsm: BuildOptions = {
    ...azExtEsbuildConfigProdEsm,
    metafile: true,
};
