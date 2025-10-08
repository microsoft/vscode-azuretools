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
 * @note This is exported but not meant to be used in isolation, but rather as a building block for other configs
 */
export const baseConfig: BuildOptions = {
    bundle: true,
    external: ['vscode'],
    outdir: './dist',
    platform: 'node',
    target: 'es2022',
    keepNames: true,
    entryPoints: ['./main.js'],
    format: 'cjs',
    plugins: [
        copy({
            assets: [
                {
                    from: './node_modules/@microsoft/vscode-azext-azureutils/resources/*.svg',
                    to: './dist/node_modules/@microsoft/vscode-azext-azureutils/resources',
                },
            ],
        }),
    ],
};

/**
 * Production config - minified, no sourcemap
 */
export const azExtEsbuildConfigProd: BuildOptions = {
    ...baseConfig,
    minify: true,
    sourcemap: false,
};

/**
 * Dev config - not minified, linked sourcemap
 */
export const azExtEsbuildConfigDev: BuildOptions = {
    ...baseConfig,
    minify: false,
    sourcemap: 'linked',
};

/**
 * Debug config - not minified, linked sourcemap, metafile
 * @note To use the metafile, it also needs to be written to disk. See https://esbuild.github.io/api/#metafile
 */
export const azExtEsbuildConfigDebug: BuildOptions = {
    ...azExtEsbuildConfigDev,
    metafile: true,
};
