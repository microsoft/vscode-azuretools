/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as webpack from 'webpack';

type DependencyEntry = {
    requires?: {
        [moduleName: string]: string;
    };
    [key: string]: unknown;
};

export type PackageLock = {
    dependencies?: { [key: string]: DependencyEntry | undefined };
    [key: string]: unknown;
};

// tslint:disable-next-line:no-reserved-keywords
type CopyEntry = { from: string; to?: string };

/**
 * Add instructions to the webpack configuration to exclude a given set of node_modules dependencies,
 * along with their dependencies.
 */
export function excludeNodeModulesAndDependencies(
    webpackConfig: webpack.Configuration,
    packageLockJson: PackageLock,
    moduleNames: string[]
): void {
    const externalModulesClosure: string[] = getNodeModulesDependencyClosure(packageLockJson, moduleNames);
    const excludeEntries: { [moduleName: string]: string } = getExternalsEntries(externalModulesClosure);
    const copyEntries: CopyEntry[] = getNodeModuleCopyEntries(externalModulesClosure);

    // Tell webpack to not place our modules into bundles
    // tslint:disable-next-line:strict-boolean-expressions
    webpackConfig.externals = webpackConfig.externals || {};
    Object.assign(webpackConfig.externals, excludeEntries);

    // Tell webpack to copy the given modules' sources into dist\node_modules
    //   so they can be found through normal require calls.
    // tslint:disable-next-line: strict-boolean-expressions
    webpackConfig.plugins = webpackConfig.plugins || [];
    webpackConfig.plugins.push(new CopyWebpackPlugin(copyEntries));
}

/**
 * Get the full set of node_modules modules plus their dependencies
 */
export function getNodeModulesDependencyClosure(packageLock: PackageLock, moduleNames: string[]): string[] {
    const closure: Set<string> = new Set<string>();
    // tslint:disable-next-line:strict-boolean-expressions no-object-literal-type-assertion
    const dependencies: { [key: string]: DependencyEntry | undefined } = packageLock.dependencies || <{ [key: string]: DependencyEntry }>{};

    for (const moduleName of moduleNames) {
        closure.add(moduleName);

        const depEntry: DependencyEntry | undefined = dependencies[moduleName];
        if (!depEntry) {
            throw new Error(`Could not find package-lock entry for ${module.filename}`);
        }

        if (depEntry.requires) {
            const requiredModules: string[] = Object.getOwnPropertyNames(depEntry.requires);
            const subdeps: string[] = getNodeModulesDependencyClosure(packageLock, requiredModules);
            for (const subdep of subdeps) {
                closure.add(subdep);
            }
        }
    }

    return Array.from(closure)
        .sort();
}

export function getExternalsEntries(moduleNames: string[]): { [moduleName: string]: string } {
    const externals: { [moduleName: string]: string } = {};

    for (const moduleName of moduleNames) {
        // We want a list of strings in this format:
        //
        //   'clipboardy': 'commonjs clipboardy'
        //
        // This means whenever we see an import/require of the form `require("clipboardy")`, then
        //   instead of processing the module into a bundle, do a regular module load of ("clipboardy") as a commonjs module.
        //
        externals[moduleName] = `commonjs ${moduleName}`;
    }

    return externals;
}

export function getNodeModuleCopyEntries(moduleNames: string[]): CopyEntry[] {
    // e.g.
    // new CopyWebpackPlugin([
    //     { from: './node_modules/clipboardy', to: 'node_modules/clipboardy' }
    //     ...
    // ])
    const copyEntries: CopyEntry[] = [];
    for (const moduleName of moduleNames) {
        copyEntries.push({
            from: `./node_modules/${moduleName}`,
            to: `node_modules/${moduleName}/`
        });
    }

    return copyEntries;
}
