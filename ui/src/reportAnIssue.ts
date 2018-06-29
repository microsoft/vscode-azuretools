/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import opn = require("opn");
import { IParsedError } from '../index';
import { ext } from "./extensionVariables";

/**
 * Used to open the browser to the "New Issue" page on GitHub with relevant context pre-filled in the issue body
 */
export function reportAnIssue(actionId: string, parsedError: IParsedError): void {
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

    const body: string = `
Repro steps:
<Enter steps to reproduce issue>

Action: ${actionId}
Error type: ${parsedError.errorType}
Error Message: ${parsedError.message}

Version: ${extensionVersion}
OS: ${process.platform}
`;
    // tslint:disable-next-line:no-floating-promises
    opn(`https://github.com/Microsoft/${extensionName}/issues/new?body=${encodeURIComponent(body)}`);
}

interface IPackageJson {
    version?: string;
    name?: string;
}
