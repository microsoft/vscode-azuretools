/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type BuildOptions as EsbuildConfig, type BuildContext, type Plugin, build, context } from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import { copyPlugin } from './copyPlugin.js';
import { getAutoBuildSettings } from './getAutoBuildSettings.js';

export { copyPlugin, type CopyAsset, type CopyPluginOptions } from './copyPlugin.js';

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

export interface WebviewEsbuildConfig extends EsbuildConfig {
    /** Set false to omit the default Sass plugin, for example when supplying a customized one. */
    sass?: boolean;
}

/** Selects browser settings from the usual debug/watch flags and appends caller-supplied plugins. */
export function createWebviewEsbuildConfig(overrides: WebviewEsbuildConfig = {}): EsbuildConfig {
    const { sass = true, ...options } = overrides;
    const config = isAutoWatch ? azExtWebviewEsbuildConfigDev
        : isAutoDebug ? azExtWebviewEsbuildConfigDebug : azExtWebviewEsbuildConfigProd;
    return {
        ...config,
        ...(isAutoDebug ? { metafile: true } : {}),
        ...options,
        loader: { ...config.loader, ...options.loader },
        plugins: [
            buildLogPlugin(),
            ...(sass ? [{
                name: 'default-sass',
                async setup(build) {
                    const { sassPlugin } = await import('./sassPlugin.js');
                    await sassPlugin().setup(build);
                },
            } satisfies Plugin] : []),
            ...(options.plugins ?? []),
        ],
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
 * One bundle in an ordered build sequence.
 */
export interface EsbuildBundle {
    config: EsbuildConfig;
    /** Set false to build only once, even when --watch is passed. */
    watch?: boolean;
    /** Relative to absWorkingDir or cwd. Defaults to esbuild.<bundle index>.meta.json. */
    metafilePath?: string;
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
export function autoSelectEsbuildConfig(esm: boolean = false, telemetry: boolean = true): EsbuildBundle[] {
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

    return [
        ...(telemetryConfig ? [{ config: telemetryConfig, watch: false }] : []),
        { config: extensionConfig },
    ];
}

/**
 * Builds bundles in supplied order, awaiting each initial build before starting the next.
 * With --watch, watches bundles unless watch is false. Writes each generated metafile separately.
 */
export async function autoEsbuildOrWatch(bundles: readonly EsbuildBundle[]): Promise<void> {
    const contexts: BuildContext[] = [];
    let stopped = false;
    function isStopped(): boolean {
        return stopped;
    }
    let stopInitial: (() => void) | undefined;
    const shutdown = new Promise<void>(resolve => { stopInitial = resolve; });
    async function dispose(): Promise<void> {
        stopped = true;
        stopInitial?.();
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        await Promise.all(contexts.splice(0).map(ctx => ctx.dispose()));
    }
    function stop(): void {
        console.log('Stopping esbuild watch');
        void dispose().catch((error: unknown) => {
            console.error(error);
            process.exitCode = 1;
        });
    }
    try {
        for (const [index, bundle] of bundles.entries()) {
            if (isStopped()) {
                return;
            }
            const config = bundle.config;
            const watching = isAutoWatch && bundle.watch !== false;
            let completed: (() => void) | undefined;
            let failed: ((error: Error) => void) | undefined;
            const metadata: Plugin = {
                name: 'bundle-result',
                setup(build) {
                    build.onEnd(async result => {
                        if (result.metafile) {
                            const destination = path.resolve(config.absWorkingDir ?? process.cwd(), bundle.metafilePath ?? `esbuild.${index}.meta.json`);
                            await fs.mkdir(path.dirname(destination), { recursive: true });
                            await fs.writeFile(destination, JSON.stringify(result.metafile));
                        }
                    });
                },
            };
            const options = { ...config, plugins: [...(config.plugins ?? []), metadata] };
            if (watching) {
                const initial = new Promise<void>((resolve, reject) => {
                    completed = resolve;
                    failed = reject;
                });
                options.plugins.push({
                    name: 'initial-build',
                    setup(build) {
                        build.onEnd(result => {
                            if (result.errors.length) {
                                failed?.(new Error(result.errors.map(error => error.text).join('\n')));
                            } else {
                                completed?.();
                            }
                            completed = undefined;
                            failed = undefined;
                        });
                    },
                });
                const ctx = await context(options);
                if (isStopped()) {
                    await ctx.dispose();
                    return;
                }
                contexts.push(ctx);
                if (contexts.length === 1) {
                    process.on('SIGINT', stop);
                    process.on('SIGTERM', stop);
                }
                await ctx.watch();
                await Promise.race([initial, shutdown]);
            } else {
                await build(options);
            }
        }
    } catch (error) {
        await dispose();
        throw error;
    }
}
