/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ext } from "./extensionVariables";

export function getPackageInfo(): [string, string] {
    let packageJson: IPackageJson | undefined;
    try {
        // tslint:disable-next-line:non-literal-require
        packageJson = <IPackageJson>require(ext.context.asAbsolutePath('package.json'));
    } catch (error) {
        // ignore errors
    }

    // tslint:disable-next-line:strict-boolean-expressions
    const extensionName: string = (packageJson && packageJson.name) || 'vscode-azuretools';
    // tslint:disable-next-line:strict-boolean-expressions
    const extensionVersion: string = (packageJson && packageJson.version) || 'Unknown';
    return [extensionName, extensionVersion];
}

interface IPackageJson {
    version?: string;
    name?: string;
}
