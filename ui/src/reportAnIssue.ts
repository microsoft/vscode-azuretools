/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IParsedError } from '../index';
import { getPackageInfo } from "./getPackageInfo";
import { openUrl } from './utils/openUrl';

/**
 * Used to open the browser to the "New Issue" page on GitHub with relevant context pre-filled in the issue body
 */
export async function reportAnIssue(actionId: string, parsedError: IParsedError): Promise<void> {
    const { extensionName, extensionVersion, bugsUrl } = getPackageInfo();

    let body: string = `
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
VS Code Version: ${vscode.version}`;

    if (parsedError.stack) {
        body = body.concat(`

<details>
<summary>Call Stack</summary>

\`\`\`
${parsedError.stack}
\`\`\`

</details>`);
    }

    const baseUrl: string = bugsUrl || `https://github.com/Microsoft/${extensionName}/issues`;
    const url: string = `${baseUrl}/new?body=${encodeURIComponent(body)}`;

    // tslint:disable-next-line:no-floating-promises
    await openUrl(url);
}
