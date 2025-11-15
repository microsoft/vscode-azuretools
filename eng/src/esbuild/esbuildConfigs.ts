/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type BuildOptions as EsbuildConfig, build, context } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import * as fs from 'fs/promises';
import { getAutoBuildSettings } from './getAutoBuildSettings.js';

const { isAutoDebug, isAutoWatch } = getAutoBuildSettings();

/**
 * Base config - shared between prod/dev/debug
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const baseEsbuildConfig: EsbuildConfig = {
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
                let start: bigint;
                build.onStart(() => {
                    if (isAutoWatch) {
                        // This format is important for the problem matcher to work
                        console.log('[watch] build started');
                    } else {
                        console.log('esbuild started');
                    }
                    start = process.hrtime.bigint();
                });

                build.onEnd(() => {
                    const elapsed = (process.hrtime.bigint() - start) / 1000000n;
                    if (isAutoWatch) {
                        // This format is important for the problem matcher to work
                        console.log(`[watch] build finished in ${elapsed} milliseconds`);
                    } else {
                        console.log(`esbuild finished in ${elapsed} milliseconds`);
                    }
                });
            },
        },
    ],
};

// #region CJS configs

/**
 * Production config - minified, no sourcemap
 */
export const azExtEsbuildConfigProd: EsbuildConfig = {
    ...baseEsbuildConfig,
    minify: true,
    sourcemap: false,
};

/**
 * Dev config - not minified, linked sourcemap
 */
export const azExtEsbuildConfigDev: EsbuildConfig = {
    ...baseEsbuildConfig,
    minify: false,
    sourcemap: 'linked',
};

/**
 * Debug config - same as prod, plus metafile
 * @note To use the metafile, it also needs to be written to disk. See https://esbuild.github.io/api/#metafile
 */
export const azExtEsbuildConfigDebug: EsbuildConfig = {
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
export const azExtEsbuildConfigProdEsm: EsbuildConfig = {
    ...azExtEsbuildConfigProd,
    banner: { js: esmBanner },
    format: 'esm',
    splitting: true,
};

/**
 * ESM dev config - not minified, linked sourcemap
 */
export const azExtEsbuildConfigDevEsm: EsbuildConfig = {
    ...azExtEsbuildConfigDev,
    banner: { js: esmBanner },
    format: 'esm',
    splitting: true,
};

/**
 * ESM debug config - same as ESM prod, plus metafile
 * @note To use the metafile, it also needs to be written to disk. See https://esbuild.github.io/api/#metafile
 */
export const azExtEsbuildConfigDebugEsm: EsbuildConfig = {
    ...azExtEsbuildConfigProdEsm,
    metafile: true,
};

// #endregion

/**
 * Auto-selects the appropriate esbuild config based on environment variables and command line args
 * @param esm (Optional) True if the ESM config should be returned
 * @returns
 * - if `process.env.DEBUG_ESBUILD` is true or 1, returns the debug config
 * - else if `--watch` is passed, returns the dev config
 * - else, returns the prod config
 */
export function autoSelectEsbuildConfig(esm?: boolean): EsbuildConfig {
    if (isAutoDebug) {
        return !!esm ? azExtEsbuildConfigDebugEsm : azExtEsbuildConfigDebug;
    } else if (isAutoWatch) {
        return !!esm ? azExtEsbuildConfigDevEsm : azExtEsbuildConfigDev;
    } else {
        return !!esm ? azExtEsbuildConfigProdEsm : azExtEsbuildConfigProd;
    }
}

/**
 * Builds or watches the given esbuild config based on environment variables and command line args
 * - if `--watch` is passed, starts esbuild in watch mode
 * - else, builds once
 *
 * Additionally, if a metafile is generated, it is written to `esbuild.meta.json`
 * @param config The config to build or watch
 */
export async function autoEsbuildOrWatch(config: EsbuildConfig): Promise<void> {
    if (isAutoWatch) {
        const ctx = await context(config);
        process.on('SIGINT', () => {
            console.log('Stopping esbuild watch');
            void ctx.dispose();
        });
        await ctx.watch();
    } else {
        const result = await build(config);

        if (!!config.metafile && !!result.metafile) {
            await fs.writeFile('esbuild.meta.json', JSON.stringify(result.metafile));
        }
    }
}
