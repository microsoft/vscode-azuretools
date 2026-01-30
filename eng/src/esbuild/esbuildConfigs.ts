/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type BuildOptions as EsbuildConfig, build, context } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import * as fs from 'fs/promises';
import { getAutoBuildSettings } from './getAutoBuildSettings.js';

export const { isAutoDebug, isAutoWatch } = getAutoBuildSettings();

/**
 * Base config - shared between telemetry/prod/dev/debug
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const baseEsbuildConfig: EsbuildConfig = {
    bundle: true,
    external: ['vscode'],
    outdir: './dist',
    platform: 'node',
    target: 'es2022',
    entryPoints: [{
        in: './src/extension.ts',
        out: 'extension.bundle',
    }],
    format: 'cjs',
    mainFields: ['module', 'main'],
};

/**
 * Config for building the telemetry bundle
 */
export const telemetryEsbuildConfig: EsbuildConfig = {
    ...baseEsbuildConfig,
    keepNames: false, // Due to object freezing in the AppInsights packages, we cannot use keepNames on the telemetry stack
    entryPoints: [{

        in: '@vscode/extension-telemetry',
        out: 'extension-telemetry.bundle',
    }],
    minify: true,
    sourcemap: false,
};

/**
 * Config for building the extension bundle
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const extensionEsbuildConfig: EsbuildConfig = {
    ...baseEsbuildConfig,
    keepNames: true,
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
    alias: {
        '@vscode/extension-telemetry': './dist/extension-telemetry.bundle.js',
    },
};

// #region CJS configs

/**
 * Production config - minified, no sourcemap
 */
export const azExtEsbuildConfigProd: EsbuildConfig = {
    ...extensionEsbuildConfig,
    minify: true,
    sourcemap: false,
};

/**
 * Dev config - not minified, linked sourcemap
 */
export const azExtEsbuildConfigDev: EsbuildConfig = {
    ...extensionEsbuildConfig,
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
 * ESM telemetry config - no splitting for this one
 */
export const telemetryEsbuildConfigEsm: EsbuildConfig = {
    ...telemetryEsbuildConfig,
    banner: { js: esmBanner },
    format: 'esm',
    splitting: false,
};

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
 * A config for building two bundles--one for the extension, one for the telemetry reporter
 */
export interface DualBundleConfig {
    /**
     * Config for building the extension bundle
     */
    extensionConfig: EsbuildConfig;

    /**
     * Config for building the telemetry bundle
     */
    telemetryConfig: EsbuildConfig;
}

/**
 * Auto-selects the appropriate esbuild config based on environment variables and command line args
 * @param esm (Optional) True if the ESM config should be returned
 * @returns
 * - if `process.env.DEBUG_ESBUILD` is true or 1, returns the debug config + telemetry config
 * - else if `--watch` is passed, returns the dev config + telemetry config
 * - else, returns the prod config + telemetry config
 */
export function autoSelectEsbuildConfig(esm?: boolean): DualBundleConfig {
    let extensionConfig: EsbuildConfig;
    if (isAutoDebug) {
        extensionConfig = !!esm ? azExtEsbuildConfigDebugEsm : azExtEsbuildConfigDebug;
    } else if (isAutoWatch) {
        extensionConfig = !!esm ? azExtEsbuildConfigDevEsm : azExtEsbuildConfigDev;
    } else {
        extensionConfig = !!esm ? azExtEsbuildConfigProdEsm : azExtEsbuildConfigProd;
    }

    const telemetryConfig = !!esm ? telemetryEsbuildConfigEsm : telemetryEsbuildConfig;

    return { extensionConfig, telemetryConfig };
}

/**
 * Builds the telemetry bundle, and then either builds or watches the extension bundle based
 * on environment variables and command line args
 * - if `--watch` is passed, starts esbuild in watch mode
 * - else, builds once
 *
 * Additionally, if a metafile is generated, it is written to `esbuild.meta.json`
 * @param configs The configs to build or watch
 */
export async function autoEsbuildOrWatch(configs: DualBundleConfig): Promise<void> {
    await build(configs.telemetryConfig);

    if (isAutoWatch) {
        const ctx = await context(configs.extensionConfig);
        process.on('SIGINT', () => {
            console.log('Stopping esbuild watch');
            void ctx.dispose();
        });
        await ctx.watch();
    } else {
        const result = await build(configs.extensionConfig);

        if (!!configs.extensionConfig.metafile && !!result.metafile) {
            await fs.writeFile('esbuild.meta.json', JSON.stringify(result.metafile));
        }
    }
}
