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
    const { name: extensionName, version: extensionVersion } = ext.packageInfo;

    const body: string = `
&lt;Please be sure to remove any private information before submitting.&gt;

Repro steps:
&lt;Enter steps to reproduce issue&gt;

Action: ${actionId}
Error type: ${parsedError.errorType}
Error Message: ${parsedError.message}

Version: ${extensionVersion}
OS: ${process.platform}
`;
    // tslint:disable-next-line:no-floating-promises
    opn(`https://github.com/Microsoft/${extensionName}/issues/new?body=${encodeURIComponent(body)}`);
}
