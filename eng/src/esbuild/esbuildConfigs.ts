/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type BuildOptions as EsbuildConfig, type Plugin, build, context } from 'esbuild';
import * as fs from 'fs/promises';
import { copyPlugin } from './copyPlugin.ts';
import { getAutoBuildSettings } from './getAutoBuildSettings.ts';

export { copyPlugin, type CopyAsset, type CopyPluginOptions } from './copyPlugin.ts';

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
    external: ['vscode'],
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
    external: [...(baseEsbuildConfig.external ?? []), './extension-telemetry.bundle.js'],
    mainFields: ['module', 'main'], // Use the 'module' field in package.json to get ESM versions of dependencies when available
    keepNames: true,
    entryPoints: [{
        in: './src/extension.ts',
        out: 'extension.bundle',
    }],
    plugins: [
        copyPlugin({
            assets: [
                {
                    from: './node_modules/@microsoft/vscode-azext-azureutils/resources',
                    to: './node_modules/@microsoft/vscode-azext-azureutils/resources',
                    include: ['*.svg', 'azureIcons/*.svg'],
                },
            ],
        }),
        buildLogPlugin(),
    ],
    alias: {
        '@vscode/extension-telemetry': './extension-telemetry.bundle.js',
    },
};

function buildLogPlugin(): Plugin {
    return {
        name: 'start-stop-log',
        setup(build) {
            let start: bigint;
            build.onStart(() => {
                // Watch messages must match the existing VS Code problem matcher.
                console.log(isAutoWatch ? '[watch] build started' : 'esbuild started');
                start = process.hrtime.bigint();
            });
            build.onEnd(() => {
                const elapsed = (process.hrtime.bigint() - start) / 1000000n;
                console.log(isAutoWatch
                    ? `[watch] build finished in ${elapsed} milliseconds`
                    : `esbuild finished in ${elapsed} milliseconds`);
            });
        },
    };
}

export const baseWebviewEsbuildConfig: EsbuildConfig = {
    bundle: true,
    outdir: './dist',
    platform: 'browser',
    target: 'es2022',
    format: 'esm',
    splitting: false,
    loader: {
        '.css': 'css',
        '.ttf': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl',
    },
};

export const azExtWebviewEsbuildConfigProd: EsbuildConfig = {
    ...baseWebviewEsbuildConfig,
    minify: true,
    sourcemap: false,
};

export const azExtWebviewEsbuildConfigDev: EsbuildConfig = {
    ...baseWebviewEsbuildConfig,
    minify: false,
    sourcemap: 'linked',
};

export const azExtWebviewEsbuildConfigDebug: EsbuildConfig = {
    ...azExtWebviewEsbuildConfigProd,
    metafile: true,
};

/** Selects browser settings from the usual debug/watch flags and appends caller-supplied plugins. */
export function createWebviewEsbuildConfig(overrides: EsbuildConfig = {}): EsbuildConfig {
    const config = isAutoDebug ? azExtWebviewEsbuildConfigDebug
        : isAutoWatch ? azExtWebviewEsbuildConfigDev : azExtWebviewEsbuildConfigProd;
    return {
        ...config,
        ...overrides,
        loader: { ...config.loader, ...overrides.loader },
        plugins: [buildLogPlugin(), ...(overrides.plugins ?? [])],
    };
}

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
// NOTE: ESM extensions must set `"type": "module"` in their package.json for these configs to work correctly.

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
    outExtension: { '.js': '.mjs', }, // Use .mjs extension for ESM files
};

/**
 * ESM dev config - not minified, linked sourcemap, splitting enabled
 */
export const azExtEsbuildConfigDevEsm: EsbuildConfig = {
    ...azExtEsbuildConfigDev,
    banner: { js: esmBanner, },
    format: 'esm',
    splitting: true,
    outExtension: { '.js': '.mjs', }, // Use .mjs extension for ESM files
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
    telemetryConfig?: EsbuildConfig;
}

/**
 * Auto-selects the appropriate esbuild config based on environment variables and command line args
 * @param esm (Optional, default: false) True if the ESM configs should be returned
 * @param telemetry (Optional, default: true) True if the telemetry config should be included
 * @returns
 * - if `process.env.DEBUG_ESBUILD` is true or 1, returns the debug config + optional telemetry config
 * - else if `--watch` is passed as an argument, returns the dev config + optional telemetry config
 * - else, returns the prod config + optional telemetry config
 */
export function autoSelectEsbuildConfig(esm: boolean = false, telemetry: boolean = true): DualBundleConfig {
    let extensionConfig: EsbuildConfig;
    let telemetryConfig: EsbuildConfig | undefined;
    if (isAutoDebug) {
        extensionConfig = esm ? azExtEsbuildConfigDebugEsm : azExtEsbuildConfigDebug;
    } else if (isAutoWatch) {
        extensionConfig = esm ? azExtEsbuildConfigDevEsm : azExtEsbuildConfigDev;
    } else {
        extensionConfig = esm ? azExtEsbuildConfigProdEsm : azExtEsbuildConfigProd;
    }

    if (telemetry) {
        telemetryConfig = esm ? telemetryEsbuildConfigEsm : telemetryEsbuildConfig;
    }

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
    if (!!configs.telemetryConfig) {
        await build(configs.telemetryConfig);
    }

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
