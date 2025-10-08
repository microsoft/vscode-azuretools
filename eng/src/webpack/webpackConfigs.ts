/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * @important When updating these configs, be sure to update the corresponding esbuild configs in file://./../esbuild/esbuildConfigs.ts
 */

import CopyPlugin from 'copy-webpack-plugin';
import type { Configuration } from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

/**
 * Base config - shared between prod/dev/debug
 * @note This is exported but not meant to be used in isolation, but rather as a building block for other configs
 */
export const baseWebpackConfig: Configuration = {
    target: 'node',
    cache: true,
    entry: './main.js',
    output: {
        filename: 'extension.bundle.js',
        path: './dist',
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
    module: {
        rules: [
            {
                test: /\.(ts|mts|cts)$/,
                exclude: /node_modules/,
                loader: 'esbuild-loader',
                options: {
                    keepNames: true,
                },
            },
        ],
    },
    ignoreWarnings: [
        () => false, // No other warnings should be ignored
    ],
};

/**
 * Production config - minified, no sourcemap
 */
export const prodWebpackConfig: Configuration = {
    ...baseWebpackConfig,
    mode: 'production',
    devtool: false,
};

/**
 * Dev config - not minified, with sourcemaps
 */
export const devWebpackConfig: Configuration = {
    ...baseWebpackConfig,
    mode: 'development',
    devtool: 'source-map',
};

/**
 * Debug config - minified, no sourcemap, with bundle analyzer
 */
export const debugWebpackConfig: Configuration = {
    ...prodWebpackConfig,
    plugins: [
        ...(prodWebpackConfig.plugins as []),
        new BundleAnalyzerPlugin({ analyzerMode: 'static' }),
    ],
};
