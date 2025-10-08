/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { BuildOptions } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';

const baseConfig: BuildOptions = {
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

export const azExtEsbuildConfigProd: BuildOptions = {
    ...baseConfig,
    minify: true,
    sourcemap: false,
};

export const azExtEsbuildConfigDev: BuildOptions = {
    ...baseConfig,
    minify: false,
    sourcemap: 'linked',
};

export const azExtEsbuildConfigDebug: BuildOptions = {
    ...azExtEsbuildConfigDev,
    metafile: true,
};
