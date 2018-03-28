/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as opn from 'opn';
import * as path from 'path';
import { IParsedError } from '../index';

export function reportIssue(parsedError: IParsedError, extensionPath?: string): void {
    let packageJson: IPackageJson | undefined;
    if (extensionPath) {
        try {
            // tslint:disable-next-line:non-literal-require
            packageJson = <IPackageJson>require(path.join(extensionPath, 'package.json'));
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

Error type: ${parsedError.errorType}
Error Message: ${parsedError.message}

Version: ${extensionVersion}
OS: ${process.platform}
`;
    // tslint:disable-next-line:no-unsafe-any
    opn(`https://github.com/Microsoft/${extensionName}/issues/new?body=${encodeURIComponent(body)}`);
}

interface IPackageJson {
    version?: string;
    name?: string;
}
