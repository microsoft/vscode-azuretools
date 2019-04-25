/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as vscode from 'vscode';
import { IParsedError } from '../index';
import { getPackageInfo } from "./getPackageInfo";
import { parseError } from './parseError';
import { openUrl } from './utils/openUrl';
import { countLines, limitLines } from './utils/textStrings';

// Some browsers don't have very long URLs
// 2000 seems a reasonable number for most browsers,
// see https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers
export const maxUrlLength: number = 2000;

/**
 * Used to open the browser to the "New Issue" page on GitHub with relevant context pre-filled in the issue body
 */
export async function reportAnIssue(actionId: string, parsedError: IParsedError): Promise<void> {
    const link: string = getReportAnIssueLink(actionId, parsedError);
    await openUrl(link);
}

export function getReportAnIssueLink(actionId: string, parsedError: IParsedError): string {
    const { extensionName, extensionVersion, bugsUrl } = getPackageInfo();

    // tslint:disable-next-line: strict-boolean-expressions
    const stack: string = (parsedError.stack || '').replace(/\r\n/g, '\n');

    // Try repeatedly with fewer lines of stack until we have a URL under the limit
    for (let stackLines: number = countLines(stack); stackLines >= 0; stackLines -= 1) {
        const url: string = createLink(stackLines, parsedError.message);
        if (url.length <= maxUrlLength) {
            return url;
        }
    }

    // If it's still too long, shorten the message;
    const urlWithNoStack: string = createLink(0, parsedError.message);
    const ellipses: string = '...';
    const reduceByChars: number = urlWithNoStack.length - maxUrlLength + ellipses.length;
    let shortMessageLength: number = parsedError.message.length - reduceByChars;

    // Since the link can increase the size of a message because of encoding, it's slightly possible that reduceByChars could overestimate
    // the number of characters to reduce by, giving us a negative message length
    shortMessageLength = Math.max(20, shortMessageLength); // (Assumes the boilerplate in the body has room for at least 20 encoded characters of message, which should be true)

    const shortMessage: string = `${parsedError.message.slice(0, shortMessageLength)}${ellipses}`;
    const shortLink: string = createLink(0, shortMessage);
    assert(shortLink.length <= maxUrlLength);
    return shortLink;

    function createLink(stackLines: number, message: string): string {
        let body: string = `
<!-- IMPORTANT: Please be sure to remove any private information before submitting. -->

Repro steps:
<!-- TODO: Enter steps to reproduce issue -->

1.
2.

Action: ${actionId}
Error type: ${parsedError.errorType}
Error Message: ${message}

Version: ${extensionVersion}
OS: ${process.platform}
Product: ${vscode.env.appName}
Product Version: ${vscode.version}
Language: ${vscode.env.language}`;

        if (stack && stackLines > 0) {
            body = body.concat(`

<details>
<summary>Call Stack</summary>

\`\`\`
${limitLines(stack, stackLines)}
\`\`\`

</details>`);
        }

        const baseUrl: string = bugsUrl || `https://github.com/Microsoft/${extensionName}/issues`;
        return `${baseUrl}/new?body=${encodeURIComponent(body)}`;
    }
}
