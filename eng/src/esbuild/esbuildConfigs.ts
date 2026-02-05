/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type BuildOptions as EsbuildConfig, build, context } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import * as fs from 'fs/promises';
import { getAutoBuildSettings } from './getAutoBuildSettings.js';

export const {
    /**
     * Whether debugging is enabled via `process.env.DEBUG_ESBUILD` (results in a metafile being generated)
     */
    isAutoDebug,

    /**
     * Whether watch build is enabled via `--watch` arg (results in non-minified build with source maps, and esbuild in watch mode)
     */
    isAutoWatch,
} = getAutoBuildSettings();

/**
 * Base config - shared between telemetry/prod/dev/debug
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const baseEsbuildConfig: EsbuildConfig = {
    bundle: true,
    outdir: './dist',
    platform: 'node',
    target: 'es2022',
    format: 'cjs',
};

/**
 * Config for building the telemetry bundle
 */
export const telemetryEsbuildConfig: EsbuildConfig = {
    ...baseEsbuildConfig,
    mainFields: ['module'], // Use the 'module' field in package.json to get only ESM versions of dependencies
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
    mainFields: ['module', 'main'], // Use the 'module' field in package.json to get ESM versions of dependencies when available
    external: ['vscode'],
    keepNames: true,
    entryPoints: [{
        in: './src/extension.ts',
        out: 'extension.bundle',
    }],
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
 * Debug config - same as {@link azExtEsbuildConfigProd} (the production config), plus metafile
 * @note To use the metafile, it also needs to be written to disk. See https://esbuild.github.io/api/#metafile
 */
export const azExtEsbuildConfigDebug: EsbuildConfig = {
    ...azExtEsbuildConfigProd,
    metafile: true,
};

// #endregion

// #region ESM configs - Here be dragons

/**
 * For ESM builds, a banner is needed to create the 'require' function, since not all of our dependencies are available as ESM
 * @note I have no idea what other effects this might have :)
 */
const esmBanner = `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`;

/**
 * ESM telemetry config - no splitting and no banner
 */
export const telemetryEsbuildConfigEsm: EsbuildConfig = {
    ...telemetryEsbuildConfig,
    // No banner needed here since the telemetry package and all its dependencies are already ESM (and the banner would cause activation to fail, see https://github.com/microsoft/vscode-azuretools/issues/2181)
    format: 'esm',
    splitting: false,
};

/**
 * ESM production config - minified, no sourcemap, splitting enabled
 */
export const azExtEsbuildConfigProdEsm: EsbuildConfig = {
    ...azExtEsbuildConfigProd,
    banner: { js: esmBanner, },
    format: 'esm',
    splitting: true,
};

/**
 * ESM dev config - not minified, linked sourcemap, splitting enabled
 */
export const azExtEsbuildConfigDevEsm: EsbuildConfig = {
    ...azExtEsbuildConfigDev,
    banner: { js: esmBanner, },
    format: 'esm',
    splitting: true,
};

/**
 * ESM debug config - same as {@link azExtEsbuildConfigProdEsm} (the production ESM config), plus metafile
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
 * @param esm (Optional) True if the ESM configs should be returned
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

    return { extensionConfig, telemetryConfig, };
}

/**
 * Builds the telemetry bundle, and then either builds or watches the extension bundle based
 * on environment variables and command line args
 * - if `--watch` is passed, starts esbuild in watch mode
 * - else, builds once
 *
 * Additionally, if a metafile is generated, it is written to `esbuild.meta.json`
 *
 * @note Even in watch mode, the telemetry bundle is only built once at startup--the build must
 * be restarted if the telemetry dependencies change
 *
 * @param configs The configs to build or watch
 */
export async function autoEsbuildOrWatch(configs: DualBundleConfig): Promise<void> {
    // Build telemetry bundle first (needed because the extension bundle depends on it)
    await build(configs.telemetryConfig);

    // Build (or watch) the extension bundle next
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
