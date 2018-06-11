/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import opn = require("opn");
import { ExtensionContext } from 'vscode';
import { IParsedError } from '../index';

/**
 * Used to open the browser to the "New Issue" page on GitHub with relevant context pre-filled in the issue body
 */
export function reportAnIssue(actionId: string, parsedError: IParsedError, extensionContext?: ExtensionContext): void {
    let packageJson: IPackageJson | undefined;
    if (extensionContext) {
        try {
            // tslint:disable-next-line:non-literal-require
            packageJson = <IPackageJson>require(extensionContext.asAbsolutePath('package.json'));
        } catch (error) {
            // ignore errors
        }
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
    opn(`https://github.com/Microsoft/${extensionName}/issues/new?body=${encodeURIComponent(body)}`);
}

interface IPackageJson {
    version?: string;
    name?: string;
}
