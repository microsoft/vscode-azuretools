/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
