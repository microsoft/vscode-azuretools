/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable: no-unsafe-any // Lots of plugin functions use any

import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import * as FileManagerPlugin from 'filemanager-webpack-plugin';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as TerserPlugin from 'terser-webpack-plugin';
import * as webpack from 'webpack';
import { Verbosity } from '../..';
import { DefaultWebpackOptions } from '../../index';
import { excludeNodeModulesAndDependencies, PackageLock } from './excludeNodeModulesAndDependencies';

// Using webpack helps reduce the install and startup time of large extensions by reducing the large number of files into a much smaller set
// Full webpack documentation: [https://webpack.js.org/configuration/]().

// tslint:disable:no-any // A lot of the plug-ins use functions with any arguments

type MessageVerbosity = Exclude<Verbosity, 'silent'>;

const verbosityMap: Map<Verbosity, number> = new Map<Verbosity, number>();
verbosityMap.set('silent', 0);
verbosityMap.set('normal', 1);
verbosityMap.set('debug', 2);

const defaultExternalNodeModules: string[] = [
    // contain dynamically-loaded binaries
    'clipboardy',
    'opn'
];

// tslint:disable-next-line:max-func-body-length
export function getDefaultWebpackConfig(options: DefaultWebpackOptions): webpack.Configuration {
    // tslint:disable-next-line: strict-boolean-expressions
    const loggingVerbosity: Verbosity = options.verbosity || 'normal';

    // Only use defaultExternalNodeModules entries that are actually in package-lock.json
    const packageLockJson: PackageLock = fse.readJsonSync(path.resolve(options.projectRoot, 'package-lock.json'));
    // tslint:disable-next-line: strict-boolean-expressions
    const existingDefaultExtNodeModules: string[] = defaultExternalNodeModules.filter((moduleName: string) => packageLockJson.dependencies && !!packageLockJson.dependencies[moduleName]);

    // tslint:disable-next-line: strict-boolean-expressions
    const externalNodeModules: string[] = (options.externalNodeModules || []).concat(existingDefaultExtNodeModules);
    log('debug', 'External node modules:', externalNodeModules);

    function log(messageVerbosity: MessageVerbosity, ...args: unknown[]): void {
        logCore(loggingVerbosity, messageVerbosity, ...args);
    }

    const config: webpack.Configuration = {
        context: options.projectRoot,

        // vscode extensions run in a Node.js context, see https://webpack.js.org/configuration/node/
        target: 'node',
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
            path: path.resolve(options.projectRoot, 'dist'),
            filename: '[name].js',
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
            ]
        },
        plugins: [
            // Copy files to dist folder where the runtime can find them
            new FileManagerPlugin({
                onEnd: {
                    copy: [
                        // Test files -> dist/test (these files are ignored during packaging)
                        {
                            source: path.join(options.projectRoot, 'out', 'test'),
                            destination: path.join(options.projectRoot, 'dist', 'test')
                        },
                        {
                            source: path.join(options.projectRoot, 'node_modules', 'vscode-azureextensionui', 'resources', '**', '*.svg'),
                            destination: path.join(options.projectRoot, 'dist', 'node_modules', 'vscode-azureextensionui', 'resources')
                        },
                        {
                            source: path.join(options.projectRoot, 'node_modules', 'vscode-azureappservice', 'resources', '**', '*.svg'),
                            destination: path.join(options.projectRoot, 'dist', 'node_modules', 'vscode-azureappservice', 'resources')
                        }
                    ]
                }
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
                (context: any): void => {
                    // ... and the call was from within node_modules/ms-rest/lib...
                    if (/node_modules[/\\]ms-rest[/\\]lib/.test(context.context)) {
                        /* CONSIDER: Figure out how to make this work properly.

                            // ... tell webpack that the call may be loading any of the package.json files from the 'node_modules/azure-arm*' folders
                            // so it will include those in the package to be available for lookup at runtime
                            context.request = path.resolve(options.projectRoot, 'node_modules');
                            context.regExp = /azure-arm.*package\.json/;
                        */

                        // In the meantime, just ignore the error by telling webpack we've solved the critical dependency issue.
                        // The consequences of ignoring this error are that
                        //   the Azure SDKs (e.g. azure-arm-resource) don't get their info stamped into the user agent info for their calls.
                        for (const d of context.dependencies) {
                            if (d.critical) {
                                d.critical = false;
                            }
                        }
                    }
                }),

            // Caller-supplied plugins
            // tslint:disable-next-line: strict-boolean-expressions
            ...(options.plugins || [])
        ],

        resolve: {
            // Support reading TypeScript and JavaScript files, see https://github.com/TypeStrong/ts-loader
            // These will be automatically transpiled while being placed into dist/extension.bundle.js
            extensions: ['.ts', '.js']
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

                // Note: If you use`vscode-nls` to localize your extension than you likely also use`vscode-nls-dev` to create language bundles at build time.
                // To support webpack, a loader has been added to vscode-nls-dev .Add the section below to the`modules/rules` configuration.
                // {
                //     // vscode-nls-dev loader:
                //     // * rewrite nls-calls
                //     loader: require.resolve('vscode-nls-dev/lib/webpack-loader'),
                //     options: {
                //         base: path.join(options.projectRoot, 'src')
                //     }
                // }

                // Caller-supplied rules
                // tslint:disable-next-line: strict-boolean-expressions
                ...(options.loaderRules || [])
            ]
        }
    };

    // Clean the dist folder before webpacking
    if (!options.suppressCleanDistFolder) {
        // tslint:disable-next-line:no-non-null-assertion
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
    // tslint:disable-next-line:no-non-null-assertion
    const loggingVerbosityValue: number = verbosityMap.get(loggingVerbosity)!;
    // tslint:disable-next-line:no-non-null-assertion
    const messageVerbosityValue: number = verbosityMap.get(messageVerbosity)!;

    if (messageVerbosityValue >= loggingVerbosityValue) {
        console.log(...args);
    }
}
