/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as TerserPlugin from 'terser-webpack-plugin';
import * as webpack from 'webpack';
import { Verbosity } from '../..';
import { DefaultWebpackOptions } from '../../index';
import { PackageLock, excludeNodeModulesAndDependencies } from './excludeNodeModulesAndDependencies';

// Using webpack helps reduce the install and startup time of large extensions by reducing the large number of files into a much smaller set
// Full webpack documentation: [https://webpack.js.org/configuration/]().

type MessageVerbosity = Exclude<Verbosity, 'silent'>;

const verbosityMap: Map<Verbosity, number> = new Map<Verbosity, number>();
verbosityMap.set('silent', 0);
verbosityMap.set('normal', 1);
verbosityMap.set('debug', 2);

const defaultExternalNodeModules: string[] = [
    // contain dynamically-loaded binaries
    'clipboardy',
    'opn', // Superseded by 'open' in vscode-azureextensionui v0.41.0+
    'open'
];

export function getDefaultWebpackConfig(options: DefaultWebpackOptions): webpack.Configuration {
    const loggingVerbosity: Verbosity = options.verbosity || 'normal';

    // Only use defaultExternalNodeModules entries that are actually in package-lock.json
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const packageLockJson: PackageLock = fse.readJsonSync(path.resolve(options.projectRoot, 'package-lock.json'));
    const existingDefaultExtNodeModules: string[] = defaultExternalNodeModules.filter((moduleName: string) => packageLockJson.dependencies && !!packageLockJson.dependencies[moduleName]);

    const externalNodeModules: string[] = (options.externalNodeModules || []).concat(existingDefaultExtNodeModules);
    log('debug', 'External node modules:', externalNodeModules);

    function log(messageVerbosity: MessageVerbosity, ...args: unknown[]): void {
        logCore(loggingVerbosity, messageVerbosity, ...args);
    }

    const plugins = [
        // Copy files to dist folder where the runtime can find them
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        new CopyWebpackPlugin({
            patterns: [
                // Test files -> dist/test (these files are ignored during packaging)
                {
                    from: '**/*',
                    context: path.posix.join(options.projectRoot.replace(/\\/g, '/'), 'out', 'test'),
                    to: path.posix.join(options.projectRoot.replace(/\\/g, '/'), 'dist', 'test'),
                    noErrorOnMissing: true
                },
                {
                    from: path.join(options.projectRoot, 'node_modules', '@microsoft', 'vscode-azext-azureutils', 'resources', '**', '*.svg'),
                    to: path.join(options.projectRoot, 'dist'),
                    noErrorOnMissing: true
                }
            ]
        }),

        // Fix error:
        //   > WARNING in ./node_modules/ms-rest/lib/serviceClient.js 441:19-43
        //   > Critical dependency: the request of a dependency is an expression
        // in this code:
        //   let data = require(packageJsonPath);
        //
        new webpack.ContextReplacementPlugin(
            // Whenever there is a dynamic require that webpack can't analyze at all (i.e. resourceRegExp=/^\./), ...
            /^\./,
            // CONSIDER: Is there a type for the context argument?  Can't seem to find one.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (context: any): void => {
                // ... and the call was from within node_modules/ms-rest/lib...
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (/node_modules[/\\]ms-rest[/\\]lib/.test(context.context as string)) {
                    /* CONSIDER: Figure out how to make this work properly.

                        // ... tell webpack that the call may be loading any of the package.json files from the 'node_modules/azure-arm*' folders
                        // so it will include those in the package to be available for lookup at runtime
                        context.request = path.resolve(options.projectRoot, 'node_modules');
                        context.regExp = /azure-arm.*package\.json/;
                    */

                    // In the meantime, just ignore the error by telling webpack we've solved the critical dependency issue.
                    // The consequences of ignoring this error are that
                    //   the Azure SDKs (e.g. azure-arm-resource) don't get their info stamped into the user agent info for their calls.
                    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
                    for (const d of context.dependencies) {
                        if (d.critical) {
                            d.critical = false;
                        }
                    }
                    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
                }
            }),

        // Caller-supplied plugins
        ...(options.plugins || [])
    ];

    if (options.target === 'webworker') {
        plugins.push(new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }));
        plugins.push(new webpack.ProvidePlugin({
            process: 'process/browser'
        }));
    }

    // needed to replace the node.js implementation of crypto with the browser implementation
    // the path is actually in utils and not dev, which is why we need to back up 4 directories
    const nodeCryptoPath = path.resolve(__dirname, '..', '..', '..', '..', 'vscode-azext-utils', 'out/src/node/crypto');
    const webCryptoPath = path.resolve(__dirname, '..', '..', '..', '..', 'vscode-azext-utils', 'out/src/browser/crypto')

    const alias: { [index: string]: string | false | string[] } = options.alias ?? {};
    alias[nodeCryptoPath] = webCryptoPath;

    const config: webpack.Configuration = {
        context: options.projectRoot,

        // vscode extensions run in a Node.js context on desktop, see https://webpack.js.org/configuration/node/
        // vscode web extensions run with a "webworker" target, see https://webpack.js.org/configuration/target/#target
        target: options.target,
        node: {
            // For __dirname and __filename, let Node.js use its default behavior (i.e., gives the path to the packed extension.bundle.js file, not the original source file)
            __filename: false,
            __dirname: false
        },

        entry: {
            // Note: Each entry is a completely separate Node.js application that cannot interact with any
            // of the others, and that individually includes all dependencies necessary (i.e. common
            // dependencies will have a copy in each entry file, no sharing).

            // The entrypoint bundle for this extension, see https://webpack.js.org/configuration/entry-context/
            "extension.bundle": './extension.bundle.ts',
            ...options.entries
        },

        output: {
            // The bundles are stored in the 'dist' folder (check package.json), see https://webpack.js.org/configuration/output/
            path: options.target === 'webworker' ? path.resolve(options.projectRoot, 'dist', 'web') : path.resolve(options.projectRoot, 'dist'),
            filename: '[name].js',
            chunkFilename: 'feature-[name].js',
            libraryTarget: 'commonjs2',

            // This is necessary to get correct paths in the .js.map files
            devtoolModuleFilenameTemplate: '../[resource-path]'
        },

        // Create .map.js files for debugging
        devtool: 'source-map',

        externals: {
            // Modules that cannot be webpack'ed, see https://webpack.js.org/configuration/externals/

            // The vscode-module is created on-the-fly so must always be excluded.
            vscode: 'commonjs vscode',

            // Caller-provided externals
            ...options.externals
        },
        optimization: {
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        // https://github.com/webpack-contrib/terser-webpack-plugin/

                        // Don't mangle class names.  Otherwise parseError() will not recognize user cancelled errors (because their constructor name
                        // will match the mangled name, not UserCancelledError).  Also makes debugging easier in minified code.
                        keep_classnames: true,

                        // Don't mangle function names. https://github.com/microsoft/vscode-azurestorage/issues/525
                        keep_fnames: true
                    }
                })
            ],
            splitChunks:
                options.target === 'webworker'
                    ? false
                    : {
                        // Disable all non-async code splitting
                        chunks: () => false,
                        cacheGroups: {
                            default: false,
                            vendors: false,
                        },
                    },
        },
        plugins,
        resolve: {
            mainFields: options.target === 'webworker' ? ['browser', 'module', 'main'] : ['module', 'main'], // look for `browser` entry point in imported node modules
            // Support reading TypeScript and JavaScript files, see https://github.com/TypeStrong/ts-loader
            // These will be automatically transpiled while being placed into dist/extension.bundle.js
            extensions: ['.ts', '.js'],
            alias:
                options.target === 'webworker' ? alias : undefined,
            fallback:
                options.target === 'webworker' ? {
                    // Webpack 5 no longer polyfills Node.js core modules automatically.
                    // see
                    // for the list of Node.js core module polyfills.
                    "path": require.resolve("path-browserify"),
                    "os": require.resolve("os-browserify/browser"),
                    "url": require.resolve("url/"),
                    "util": require.resolve("util/"),
                    "stream": require.resolve("stream-browserify"),
                    "http": require.resolve("stream-http"),
                    "querystring": require.resolve("querystring-es3"),
                    "zlib": require.resolve("browserify-zlib"),
                    "assert": require.resolve("assert/"),
                    "process": require.resolve("process/browser"),
                    "https": require.resolve("https-browserify"),
                    "console": require.resolve('console-browserify'),
                    "async_hooks": false,
                    "child_process": false,
                    "fs": false,
                    'html-to-text': false,
                    // there are browserify versions of these, but they cause more problems than they solve
                    'net': false,
                    'crypto': false,
                    //caller-supplied fallbacks
                    ...(options.resolveFallbackAliases || [])
                } : undefined,
        },

        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: [{
                        // Note: the TS loader will transpile the .ts file directly during webpack (i.e., webpack is directly pulling the .ts files, not .js files from out/)
                        loader: require.resolve('ts-loader')
                    }]
                },

                // Caller-supplied rules
                ...(options.loaderRules || [])
            ]
        },
        ignoreWarnings: [
            {
                // Ignore a warning from `@vscode/extension-telemetry`
                module: /node_modules\/@vscode\/extension-telemetry/,
                message: /Can't resolve 'applicationinsights-native-metrics'/
            },
        ]
    };

    // Clean the dist folder before webpacking
    if (!options.suppressCleanDistFolder) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        config.plugins!.push(
            new CleanWebpackPlugin(
                {
                    verbose: true
                })
        );
    }

    // Exclude specified node modules and their dependencies from webpack bundling
    excludeNodeModulesAndDependencies(options.projectRoot, config, packageLockJson, externalNodeModules, (...args: unknown[]) => log('debug', ...args));

    return config;
}

function logCore(loggingVerbosity: Verbosity, messageVerbosity: MessageVerbosity, ...args: unknown[]): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const loggingVerbosityValue: number = verbosityMap.get(loggingVerbosity)!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const messageVerbosityValue: number = verbosityMap.get(messageVerbosity)!;

    if (messageVerbosityValue >= loggingVerbosityValue) {
        console.log(...args);
    }
}
