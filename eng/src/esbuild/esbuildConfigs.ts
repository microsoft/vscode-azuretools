/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * @important When updating these configs, be sure to update the corresponding webpack configs in file://./../webpack/webpackConfigs.ts
 */

import { type BuildOptions, build, context } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import * as fs from 'fs/promises';

const isAutoDebug = !!process.env.DEBUG_ESBUILD;
const isAutoWatch = process.argv.includes('--watch');

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
    mainFields: ['module', 'main'],
    plugins: [
        copy({
            assets: [
                {
                    from: './node_modules/@microsoft/vscode-azext-azureutils/resources/*.svg',
                    to: './node_modules/@microsoft/vscode-azext-azureutils/resources',
                },
            ],
        }),
        {
            name: 'start-stop-log',
            setup(build) {
                let start: bigint, end: bigint;

                build.onStart(() => {
                    console.log(`${isAutoWatch ? '[watch] ' : ''}build started`);
                    start = process.hrtime.bigint();
                });

                build.onEnd(() => {
                    end = process.hrtime.bigint();
                    console.log(`${isAutoWatch ? '[watch] ' : ''}build finished in ${(end - start) / 1000000n} milliseconds`);
                });
            },
        },
    ],
};

// #region CJS configs

/**
 * Production config - minified, no sourcemap
 */
export const azExtEsbuildConfigProd: BuildOptions = {
    ...baseEsbuildConfig,
    minify: true,
    sourcemap: false,
};

/**
 * Dev config - not minified, linked sourcemap
 */
export const azExtEsbuildConfigDev: BuildOptions = {
    ...baseEsbuildConfig,
    minify: false,
    sourcemap: 'linked',
};

/**
 * Debug config - same as prod, plus metafile
 * @note To use the metafile, it also needs to be written to disk. See https://esbuild.github.io/api/#metafile
 */
export const azExtEsbuildConfigDebug: BuildOptions = {
    ...azExtEsbuildConfigProd,
    metafile: true,
};

// #endregion

// #region ESM configs - Here be dragons

// For ESM builds, a banner is needed to create the 'require' function, since not all of our dependencies are available as ESM
// I have no idea what other effects this might have :)
const esmBanner = `
import {createRequire} from 'module';
const require = createRequire(import.meta.url);
`;

/**
 * ESM production config - minified, no sourcemap
 */
export const azExtEsbuildConfigProdEsm: BuildOptions = {
    ...azExtEsbuildConfigProd,
    banner: { js: esmBanner },
    format: 'esm',
    splitting: true,
};

/**
 * ESM dev config - not minified, linked sourcemap
 */
export const azExtEsbuildConfigDevEsm: BuildOptions = {
    ...azExtEsbuildConfigDev,
    banner: { js: esmBanner },
    format: 'esm',
    splitting: true,
};

/**
 * ESM debug config - same as ESM prod, plus metafile
 * @note To use the metafile, it also needs to be written to disk. See https://esbuild.github.io/api/#metafile
 */
export const azExtEsbuildConfigDebugEsm: BuildOptions = {
    ...azExtEsbuildConfigProdEsm,
    metafile: true,
};

// #endregion

/**
 * Auto-selects the appropriate esbuild config based on environment variables and command line args
 * @param esm true if the ESM config should be returned
 * @returns
 * - if `process.env.DEBUG_ESBUILD` is truthy, returns the debug config
 * - else if `--watch` is passed, returns the dev config
 * - else, returns the prod config
 */
export function autoSelectEsbuildConfig(esm: boolean): BuildOptions {
    if (isAutoDebug) {
        return esm ? azExtEsbuildConfigDebugEsm : azExtEsbuildConfigDebug;
    } else if (isAutoWatch) {
        return esm ? azExtEsbuildConfigDevEsm : azExtEsbuildConfigDev;
    } else {
        return esm ? azExtEsbuildConfigProdEsm : azExtEsbuildConfigProd;
    }
}

/**
 * Builds or watches the given esbuild config based on environment variables and command line args
 * @param config The config to build or watch
 */
export async function autoEsbuildOrWatch(config: BuildOptions): Promise<void> {
    if (isAutoWatch) {
        const ctx = await context(config);
        process.on('SIGINT', () => {
            console.log('Stopping esbuild watch');
            ctx.dispose();
        });
        await ctx.watch();
    } else {
        const result = await build(config);

        if (isAutoDebug) {
            await fs.writeFile('esbuild.meta.json', JSON.stringify(result.metafile));
        }
    }
}
