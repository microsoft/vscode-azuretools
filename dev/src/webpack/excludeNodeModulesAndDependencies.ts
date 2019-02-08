/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as FilemanagerWebpackPlugin from 'filemanager-webpack-plugin';
import * as path from 'path';
import * as webpack from 'webpack';

type DependencyEntry = {
    dependencies?: {
        [moduleName: string]: DependencyEntry;
    };
    requires?: {
        [moduleName: string]: string;
    };
    [key: string]: unknown;
};

export type PackageLock = {
    dependencies?: { [key: string]: DependencyEntry | undefined };
    [key: string]: unknown;
};

type CopyEntry = { source: string; destination: string };

/**
 * Add instructions to the webpack configuration to exclude a given set of node_modules dependencies,
 * along with their dependencies.
 */
export function excludeNodeModulesAndDependencies(
    projectRoot: string,
    webpackConfig: webpack.Configuration,
    packageLockJson: PackageLock,
    moduleNames: string[],
    log: (...args: unknown[]) => void = (): void => { /* noop */ }
): void {
    const externalModulesClosure: string[] = getNodeModulesDependencyClosure(packageLockJson, moduleNames);
    const excludeEntries: { [moduleName: string]: string } = getExternalsEntries(externalModulesClosure);
    const copyEntries: CopyEntry[] = getNodeModuleCopyEntries(projectRoot, externalModulesClosure);

    // Tell webpack to not place our modules into bundles
    // tslint:disable-next-line:strict-boolean-expressions
    webpackConfig.externals = webpackConfig.externals || {};
    log('Excluded node modules (external node modules plus dependencies)', externalModulesClosure);
    Object.assign(webpackConfig.externals, excludeEntries);

    // Tell webpack to copy the given modules' sources into dist\node_modules
    //   so they can be found through normal require calls.
    // tslint:disable-next-line: strict-boolean-expressions
    webpackConfig.plugins = webpackConfig.plugins || [];
    webpackConfig.plugins.push(new FilemanagerWebpackPlugin(
        {
            onEnd: {
                copy: copyEntries
            }
        }
    ));
}

/**
 * Get the full set of node_modules modules plus their dependencies
 */
export function getNodeModulesDependencyClosure(packageLock: PackageLock, moduleNames: string[]): string[] {
    const closure: Set<string> = new Set<string>();
    // tslint:disable-next-line:strict-boolean-expressions no-object-literal-type-assertion
    const dependencies: { [key: string]: DependencyEntry | undefined } = packageLock.dependencies || <{ [key: string]: DependencyEntry }>{};

    for (const moduleName of moduleNames) {
        if (dependencies[moduleName]) {
            closure.add(moduleName);
            // tslint:disable-next-line:no-non-null-assertion
            const subdeps: string[] = getDependenciesFromEntry(dependencies[moduleName]!, packageLock);
            for (const subdep of subdeps) {
                closure.add(subdep);
            }
        } else {
            throw new Error(`Could not find dependency entry for ${moduleName}`);
        }
    }

    return Array.from(closure)
        .sort();
}

function getDependenciesFromEntry(depEntry: DependencyEntry, packageLock: PackageLock): string[] {
    // Example entry:
    //
    // "braces": {
    //     "version": "2.3.2",
    //     "requires": {
    //         "arr-flatten": "^1.1.0",
    //         "array-unique": "^0.3.2",
    //     },
    //     "dependencies": {
    //         "extend-shallow": {
    //             "version": "2.0.1",
    //             "requires": {
    //                 "is-extendable": "^0.1.0"
    //             }
    //         }
    //     }
    // },

    const closure: Set<string> = new Set<string>();

    // tslint:disable-next-line:strict-boolean-expressions no-object-literal-type-assertion
    const dependencies: { [key: string]: DependencyEntry | undefined } = depEntry.dependencies || <{ [key: string]: DependencyEntry }>{};
    // tslint:disable-next-line:no-object-literal-type-assertion strict-boolean-expressions
    const requires: { [key: string]: string } = depEntry.requires || <{ [key: string]: string }>{};

    // Handle dependencies
    for (const moduleName of Object.keys(dependencies)) {
        closure.add(moduleName);

        // tslint:disable-next-line:no-non-null-assertion
        const dependenciesSubdeps: string[] = getDependenciesFromEntry(dependencies[moduleName]!, packageLock);
        for (const subdep of dependenciesSubdeps) {
            closure.add(subdep);
        }
    }

    // Handle requires that aren't listed in dependencies by resolving them at the top level
    const requiredModules: string[] = Object.getOwnPropertyNames(requires)
        .filter((m: string) => !(m in dependencies));
    const requiresSubdeps: string[] = getNodeModulesDependencyClosure(packageLock, requiredModules);
    for (const subdep of requiresSubdeps) {
        closure.add(subdep);
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

export function getNodeModuleCopyEntries(projectRoot: string, moduleNames: string[]): CopyEntry[] {
    // e.g.
    // new FilemanagerWebpackPlugin([
    //     {
    //         onEnd: {
    //             copy: [
    //                 { source: '/root/node_modules/clipboardy', destination: '/root/dist/node_modules/clipboardy' }
    //     ...
    const copyEntries: CopyEntry[] = [];
    for (const moduleName of moduleNames) {
        copyEntries.push({
            source: path.join(projectRoot, 'node_modules', moduleName),
            destination: path.join(projectRoot, 'dist', 'node_modules', moduleName)
        });
    }

    return copyEntries;
}
