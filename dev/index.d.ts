/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OutputChannel } from "vscode";
import * as webpack from 'webpack';

/**
 * Sets up test suites against an extension package.json file (run this at global level or inside a suite, not inside a test)
 *
 * @param packageJson The extension's package.json contents as an object
 */
export declare function addPackageLintSuites(
    getExtensionContext: () => {},
    getCommands: () => Promise<string[]>,
    packageJsonAsObject: {},
    options: IPackageLintOptions
): void;


export interface IPackageLintOptions {
    /**
     * Commands which are registered by the extension but should not appear in package.json
     */
    commandsRegisteredButNotInPackage?: string[];
}

/**
 * Re-routes output to the console instead of a VS Code output channel (which disappears after a test run has finished)
 */
export class TestOutputChannel implements OutputChannel {
    public name: string;
    public append(value: string): void;
    public appendLine(value: string): void;
    public clear(): void;
    public show(): void;
    public hide(): void;
    public dispose(): void;
}

export type Verbosity = 'debug' | 'silent' | 'normal';

export interface DefaultWebpackOptions {
    projectRoot: string;

    /**
     * Additional entrypoints besides the main 'extension' entrypoint
     */
    entries?: { [key: string]: string };

    /**
     * Modules that we can't easily webpack for some reason. These node modules and all their dependencies will be excluded from bundling.
     */
    externalNodeModules?: string[];

    /** Additional external entries (externalNodeModules are added automatically) */
    externals?: webpack.ExternalsObjectElement,

    /**
     * Additional loader module rules
     */
    loaderRules?: webpack.RuleSetRule[],

    /**
     * Additional plug-ins
     */
    plugins?: webpack.Plugin[];

    /**
     * Suppress deleting the dist folder before webpack
     */
    suppressCleanDistFolder?: boolean;

    /**
     * Logging verbosity
     */
    verbosity?: Verbosity;
}

export declare function getDefaultWebpackConfig(options: DefaultWebpackOptions): webpack.Configuration;
