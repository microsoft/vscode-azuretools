/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type BuildOptions as EsbuildConfig, type BuildContext, type Plugin, build, context } from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';
import { copyPlugin } from './copyPlugin.js';
import { getAutoBuildSettings } from './getAutoBuildSettings.js';
import { sassPlugin } from './sassPlugin.js';

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
    metafile: false,
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
    ],
    alias: {
        '@vscode/extension-telemetry': './extension-telemetry.bundle.js',
    },
};

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
    let config = azExtWebviewEsbuildConfigProd;

    if (isAutoWatch) {
        config = azExtWebviewEsbuildConfigDev;
    } else if (isAutoDebug) {
        config = azExtWebviewEsbuildConfigDebug;
    }

    return {
        ...config,
        ...(isAutoDebug ? { metafile: true } : {}),
        ...options,
        loader: { ...config.loader, ...options.loader },
        plugins: [
            ...(sass ? [sassPlugin()] : []),
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

/** Named build configurations. Undefined entries are omitted from the build sequence. */
export type EsbuildConfigs = Record<string, EsbuildConfig | undefined>;

/** The selector always supplies an extension configuration and optionally telemetry. */
export interface ExtensionEsbuildConfigs extends EsbuildConfigs {
    extension: EsbuildConfig;
    telemetry?: EsbuildConfig;
}

/**
 * Auto-selects the appropriate esbuild config based on environment variables and command line args
 * @param esm (Optional, default: false) True if the ESM configs should be returned
 * @param telemetry (Optional, default: true) True if the telemetry config should be included
 * @returns
 * - if `--watch` is passed as an argument, returns the dev config + optional telemetry config
 * - else if `process.env.DEBUG_ESBUILD` is true or 1, returns the debug config + optional telemetry config
 * - else, returns the prod config + optional telemetry config
 * Debug independently enables extension metadata, including in watch mode.
 */
export function autoSelectEsbuildConfig(esm: boolean = false, telemetry: boolean = true): ExtensionEsbuildConfigs {
    let extensionConfig: EsbuildConfig;
    let telemetryConfig: EsbuildConfig | undefined;

    if (isAutoDebug && !isAutoWatch) {
        extensionConfig = esm ? azExtEsbuildConfigDebugEsm : azExtEsbuildConfigDebug;
    } else if (isAutoWatch) {
        extensionConfig = { ...(esm ? azExtEsbuildConfigDevEsm : azExtEsbuildConfigDev) };
        if (isAutoDebug) {
            extensionConfig.metafile = true;
        }
    } else {
        extensionConfig = esm ? azExtEsbuildConfigProdEsm : azExtEsbuildConfigProd;
    }

    if (telemetry) {
        telemetryConfig = esm ? telemetryEsbuildConfigEsm : telemetryEsbuildConfig;
    }

    return { extension: extensionConfig, telemetry: telemetryConfig };
}

/**
 * Builds telemetry once first, then other configs in property enumeration order.
 * Awaits each initial build, including in watch mode. Keys name errors and metadata files.
 */
export async function autoEsbuildOrWatch(configs: Readonly<EsbuildConfigs>): Promise<void> {
    const entries: [string, EsbuildConfig][] = [];

    for (const [name, config] of Object.entries(configs)) {
        if (config !== undefined) {
            if (name === 'telemetry') {
                entries.unshift([name, config]);
            } else {
                entries.push([name, config]);
            }
        }
    }

    validateBundleNames(entries.map(([name]) => name));

    if (entries.length === 0) {
        return;
    }

    const progress = createBuildProgress();
    const contexts: BuildContext[] = [];
    let stopped = false;
    let releaseInitialBuildWait: (() => void) | undefined;
    const shutdown = new Promise<void>(resolve => {
        releaseInitialBuildWait = resolve;
    });

    async function dispose(): Promise<void> {
        stopped = true;
        progress.stop();
        releaseInitialBuildWait?.();
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
        progress.beginInitialization();

        for (const [name, config] of entries) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Signal callbacks can change this flag between builds.
            if (stopped) {
                return;
            }

            const watching = isAutoWatch && name !== 'telemetry';

            const options = {
                ...config,
                metafile: name === 'telemetry' ? false : config.metafile,
                plugins: [...(config.plugins ?? []), metafilePlugin(name, config), buildProgressPlugin(progress)],
            };

            try {
                if (watching) {
                    const initial = createInitialBuild();
                    options.plugins.push(initial.plugin);

                    const ctx = await context(options);
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Signal callbacks can change this flag during context creation.
                    if (stopped) {
                        await ctx.dispose();
                        return;
                    }

                    contexts.push(ctx);
                    if (contexts.length === 1) {
                        process.on('SIGINT', stop);
                        process.on('SIGTERM', stop);
                    }

                    await ctx.watch();
                    await Promise.race([initial.promise, shutdown]);
                } else {
                    await build(options);
                }
            } catch (error) {
                throw new Error(
                    `Failed to build bundle "${name}": ${error instanceof Error ? error.message : String(error)}`,
                    { cause: error },
                );
            }
        }

        progress.completeInitialization();
    } catch (error) {
        await dispose();

        throw error;
    }
}

/**
 * watch() enables watching without awaiting its first build. Append this plugin last
 * to await that result, including earlier post-build hooks, and propagate startup errors.
 */
function createInitialBuild(): { plugin: Plugin; promise: Promise<void> } {
    let completed: (() => void) | undefined;
    let failed: ((error: Error) => void) | undefined;
    const promise = new Promise<void>((resolve, reject) => {
        completed = resolve;
        failed = reject;
    });

    const plugin: Plugin = {
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
    };

    return { plugin, promise };
}

interface BuildProgress {
    beginInitialization(): void;
    completeInitialization(): void;
    bundleStarted(): void;
    bundleFinished(): void;
    stop(): void;
}

/** One coordinator per runner: startup is one cycle, then overlapping rebuilds share a cycle. */
function createBuildProgress(): BuildProgress {
    let initializing = true;
    let activeBuilds = 0;
    let stopped = false;
    let start: bigint;

    function startCycle(): void {
        // Watch messages must match the existing VS Code problem matcher.
        console.log(isAutoWatch ? '[watch] build started' : 'esbuild started');
        start = process.hrtime.bigint();
    }

    function finishCycleIfReady(): void {
        if (initializing || activeBuilds !== 0 || stopped) {
            return;
        }

        const elapsed = (process.hrtime.bigint() - start) / 1000000n;
        console.log(isAutoWatch
            ? `[watch] build finished in ${elapsed} milliseconds`
            : `esbuild finished in ${elapsed} milliseconds`);
    }

    return {
        beginInitialization(): void {
            startCycle();
        },
        completeInitialization(): void {
            initializing = false;
            finishCycleIfReady();
        },
        bundleStarted(): void {
            if (stopped) {
                return;
            }

            if (!initializing && activeBuilds === 0) {
                startCycle();
            }

            activeBuilds++;
        },
        bundleFinished(): void {
            if (stopped) {
                return;
            }

            activeBuilds--;
            finishCycleIfReady();
        },
        stop(): void {
            stopped = true;
        },
    };
}

/** Reports this bundle's activity to the shared coordinator, after earlier post-build hooks. */
function buildProgressPlugin(progress: BuildProgress): Plugin {
    return {
        name: 'build-progress',
        setup(build) {
            build.onStart(() => {
                progress.bundleStarted();
            });
            build.onEnd(() => {
                progress.bundleFinished();
            });
        },
    };
}

function metafilePlugin(name: string, config: EsbuildConfig): Plugin {
    return {
        name: 'bundle-result',
        setup(build) {
            build.onEnd(async result => {
                if (result.metafile) {
                    const destination = path.resolve(
                        config.absWorkingDir ?? process.cwd(),
                        `esbuild.${name}.meta.json`,
                    );

                    await fs.mkdir(path.dirname(destination), { recursive: true });
                    await fs.writeFile(destination, JSON.stringify(result.metafile));
                }
            });
        },
    };
}

function validateBundleNames(bundleNames: readonly string[]): void {
    const names = new Set<string>();

    for (const name of bundleNames) {
        if (!/^[a-z0-9_-][a-z0-9_.-]*$/i.test(name)) {
            throw new Error('Bundle names must be non-empty filename-safe identifiers using letters, numbers, underscores, hyphens, or dots.');
        }

        const key = name.toLowerCase();
        if (names.has(key)) {
            throw new Error(`Duplicate bundle name: "${name}".`);
        }

        names.add(key);
    }
}
