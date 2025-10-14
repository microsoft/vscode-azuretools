/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * @important When updating these configs, be sure to update the corresponding esbuild configs in file://./../esbuild/esbuildConfigs.ts
 */

import CopyPlugin from 'copy-webpack-plugin';
import * as path from 'path';
import type { Configuration } from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

const isAutoDebug = !!process.env.DEBUG_WEBPACK;
const isAutoWatch = process.argv.includes('--watch');

/**
 * Base config - shared between prod/dev/debug
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const baseWebpackConfig: Configuration = {
    target: 'node',
    cache: true,
    entry: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        './extension.bundle': './src/extension.ts',
    },
    output: {
        clean: true,
        filename: '[name].js',
        path: path.resolve(process.cwd(), 'dist'),
        libraryTarget: 'commonjs2',
    },
    externals: {
        vscode: 'commonjs vscode',
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                './node_modules/@microsoft/vscode-azext-azureutils/resources/*.svg',
            ],
        }),
    ],
    resolve: {
        extensions: ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'],
    },
    module: {
        rules: [
            {
                test: /\.(ts|mts|cts|js|mjs|cjs)$/,
                exclude: /node_modules/,
                loader: 'esbuild-loader',
                options: {
                    keepNames: true,
                },
            },
        ],
    },
    ignoreWarnings: [
        {
            // Ignore a warning for a missing optional dependency of `ws` via `@microsoft/vscode-azext-azureappservice`
            module: /node_modules\/ws/,
            message: /Can't resolve 'bufferutil'/,
        },
        {
            // Ignore another warning for a missing optional dependency of `ws` via `@microsoft/vscode-azext-azureappservice`
            module: /node_modules\/ws/,
            message: /Can't resolve 'utf-8-validate'/,
        },
        () => false, // No other warnings should be ignored
    ],
};

/**
 * Production config - minified, no sourcemap
 */
export const azExtWebpackConfigProd: Configuration = {
    ...baseWebpackConfig,
    mode: 'production',
    devtool: false,
};

/**
 * Dev config - not minified, with sourcemaps
 */
export const azExtWebpackConfigDev: Configuration = {
    ...baseWebpackConfig,
    mode: 'development',
    devtool: 'source-map',
};

/**
 * Debug config - same as prod, plus bundle analyzer
 */
export const azExtWebpackConfigDebug: Configuration = {
    ...azExtWebpackConfigProd,
    plugins: [
        ...azExtWebpackConfigProd.plugins ?? [],
        new BundleAnalyzerPlugin({ analyzerMode: 'static' }),
    ],
};

/**
 * Auto-selects the appropriate webpack config based on environment variables and command line args
 * @returns
 * - if `process.env.DEBUG_WEBPACK` is truthy, returns the debug config
 * - else if `--watch` is passed, returns the dev config
 * - else, returns the prod config
 */
export function autoSelectWebpackConfig(): Configuration {
    if (isAutoDebug) {
        return azExtWebpackConfigDebug;
    } else if (isAutoWatch) {
        return azExtWebpackConfigDev;
    } else {
        return azExtWebpackConfigProd;
    }
}
