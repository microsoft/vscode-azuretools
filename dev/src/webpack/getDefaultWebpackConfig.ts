/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable: no-unsafe-any // Lots of plugin functions use any

import * as CleanWebpackPlugin from 'clean-webpack-plugin';
import * as FileManagerPlugin from 'filemanager-webpack-plugin';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as StringReplacePlugin from 'string-replace-webpack-plugin';
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
    // Electron fork depends on file at location of original source
    'vscode-languageclient',

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
                        keep_classnames: true
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

            // An instance of the StringReplacePlugin plugin must be present for it to work (its use is configured in modules).
            //
            // StringReplacePlugin allows you to specific parts of a file by regexp replacement to get around webpack issues such as dynamic imports.
            // This is different from ContextReplacementPlugin, which is simply meant to help webpack find files referred to by a dynamic import (i.e. it
            //   assumes  they can be found by simply knowing the correct the path).
            new StringReplacePlugin(),

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

                // Handle references to loose resource files in vscode-azureextensionui.  These are problematic because:
                //   1) Webpack doesn't know about them because they don't appear in import() statements, therefore they don't get placed into dist
                //   2) __dirname/__filename give the path to the extension.bundle.js file, so paths will be wrong even if we copy them.
                //
                // Strategy to handle them:
                //   1) Use the 'file-loader' webpack loader. In this pattern, the source code uses a require() statement to reference to the file. Since
                //      webpack process require(), it will call the file-loader, which will return the resource path (not the contents) as the value of the require.
                //      This loader also automatically copies the file into the dist folder where it can be found.
                //   2) Sources have to be modified to use a require() statement for any resource that needs to be handled this way.  Many of these can be found because
                //      they are using __dirname/__filename to find the resource file at runtime.
                {
                    test: /(vscode-azureextensionui)|(vscode-azureappservice)/,
                    loader: StringReplacePlugin.replace({
                        replacements: [
                            {
                                // Rewrite references to resources in vscode-azureextensionui so file-loader can process them.
                                //
                                // e.g. change this:
                                //   path.join(__dirname, '..', '..', '..', '..', 'resources', 'dark', 'Loading.svg')
                                //
                                //     to this:
                                //
                                // require(__dirname + '/..' + '/..' + '/..' + '/..' + '/resources' + '/dark' + '/Loading.svg')
                                //
                                pattern: /path.join\((__dirname|__filename),.*'resources',.*'\)/ig,
                                replacement: (match: any, _offset: any, _string: any): string => {
                                    const pathExpression: string = match
                                        .replace(/path\.join\((.*)\)/, '$1')
                                        .replace(/\s*,\s*['"]/g, ` + '/`);
                                    const requireExpression: string = `require(${pathExpression})`;
                                    const resolvedExpression: string = `path.resolve(__dirname, ${requireExpression})`;
                                    log('normal', `Rewrote resource reference: "${match}" => "${resolvedExpression}"`);
                                    return resolvedExpression;
                                }
                            }
                        ]
                    })
                },

                {
                    // This loader allows you to use a require() statement to get the path (not contents) to a loose file at runtime. Any file
                    //   with the given extension referenced by a require() will be copied to the dist folder, and the require() at runtime will
                    //   return a path to the copied file (not the contents).
                    // For example:
                    //   let myResourcePath = require(__dirname + '/resources/myresource.gif'); // (No, this will not work if not processed by webpack);
                    //   (note that __dirname will not return the expected result at runtime because webpack flattens all source folders)
                    // At pack time:
                    //    <src>/<path>/<path>/resources/myresource.gif will be copied to dist/<path>/<path>/resources/myresource.gif
                    // At runtime:
                    //    require() will return the absolute path to dist/<path>/<path>/resources/myresource.gif
                    test: /\.(png|jpg|gif|svg)$/,
                    use: [
                        {
                            loader: require.resolve('file-loader'),
                            options: {
                                name: (name: string): string => {
                                    log('normal', `Extracting resource file ${name}`);
                                    return '[path][name].[ext]';
                                }
                            }
                        }
                    ]
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
                ['dist'],
                {
                    root: options.projectRoot,
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
