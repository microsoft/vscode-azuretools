/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IParsedError } from '../index';
import { getPackageInfo } from "./getPackageInfo";
import { limitLines, numberOfLines } from './utils/limitLines';
import { openUrl } from './utils/openUrl';

/**
 * Used to open the browser to the "New Issue" page on GitHub with relevant context pre-filled in the issue body
 */
export async function reportAnIssue(actionId: string, parsedError: IParsedError): Promise<void> {
    const { extensionName, extensionVersion, bugsUrl } = getPackageInfo();

    // Some browsers don't have very long URLs
    // tslint:disable-next-line: typedef
    const maxUrlLength = 2000;

    // tslint:disable-next-line: strict-boolean-expressions
    const stack: string = parsedError.stack || '';

    const body: string = `
<!-- IMPORTANT: Please be sure to remove any private information before submitting. -->

Repro steps:
<!-- TODO: Enter steps to reproduce issue -->

1.
2.

Action: ${actionId}
Error type: ${parsedError.errorType}
Error Message: ${parsedError.message}

Version: ${extensionVersion}
OS: ${process.platform}
Product: ${vscode.env.appName}
Product Version: ${vscode.version}
Language: ${vscode.env.language}`;

    // Try repeatedly with fewer lines of stack until we have a URL of a reasonable length
    // tslint:disable-next-line: no-increment-decrement
    for (let stackLines: number = numberOfLines(stack); stackLines >= 0; --stackLines) {
        let bodyWithStack: string = body;
        if (stack) {
            bodyWithStack = bodyWithStack.concat(`

            <details>
<summary>Call Stack</summary>

\`\`\`
${limitLines(stack, stackLines)}
\`\`\`

</details>`);

            const baseUrl: string = bugsUrl || `https://github.com/Microsoft/${extensionName}/issues`;
            const url: string = `${baseUrl}/new?body=${encodeURIComponent(bodyWithStack)}`;

            if (url.length < maxUrlLength || stackLines === 0) {
                // tslint:disable-next-line:no-floating-promises
                await openUrl(url);
                return;
            }
        }
    }
}
