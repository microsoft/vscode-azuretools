/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as vscode from 'vscode';
import * as types from '../index';
import { getPackageInfo } from "./getPackageInfo";
import { localize } from './localize';
import { openUrl } from './utils/openUrl';

// Some browsers don't have very long URLs
// 2000 seems a reasonable number for most browsers,
// see https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers
export const maxUrlLength: number = 2000;

export interface IReportableIssue {
    callbackId: string;
    error: types.IParsedError;
    issueProperties: { [key: string]: string | undefined };
    time: number;
}

/**
 * Used to open the browser to the "New Issue" page on GitHub with relevant context pre-filled in the issue body
 */
export async function reportAnIssue(issue: IReportableIssue | undefined): Promise<void> {
    const link: string = await getReportAnIssueLink(issue);
    await openUrl(link);
}

export async function getReportAnIssueLink(issue: IReportableIssue | undefined): Promise<string> {
    const { extensionVersion } = getPackageInfo();

    const stack: string = (issue?.error.stack || '').replace(/\r\n/g, '\n');

    let body: string = `
<!-- ${localize('reportIssue_removePrivateInfo', "IMPORTANT: Please be sure to remove any private information before submitting.")} -->

${localize('reportIssue_isItConsistent', "Does this occur consistently? <!-- TODO: Type Yes or No -->")}
Repro steps:
<!-- ${localize('reportIssue_enterReproSteps', "TODO: Share the steps needed to reliably reproduce the problem. Please include actual and expected results.")} -->

1.
2.`;

    if (issue) {
        body += `

Action: ${issue.callbackId}
Error type: ${issue.error.errorType}
Error Message: ${issue.error.message}
`;
    }

    body += `

Version: ${extensionVersion}
OS: ${process.platform}
OS Release: ${os.release()}
Product: ${vscode.env.appName}
Product Version: ${vscode.version}
Language: ${vscode.env.language}`;

    // Add stack and any custom issue properties as individual details
    const details: { [key: string]: string | undefined } = Object.assign({}, stack ? { 'Call Stack': stack } : {}, issue?.issueProperties); // Don't localize call stack
    for (const propName of Object.getOwnPropertyNames(details)) {
        const value: string | undefined = details[propName];
        body += createBodyDetail(propName, String(value));
    }

    const simpleLink: string = createNewIssueLinkFromBody(body);
    if (simpleLink.length <= maxUrlLength) {
        return simpleLink;
    }

    // If it's too long, paste it to the clipboard
    await vscode.env.clipboard.writeText(body);
    return createNewIssueLinkFromBody(localize('pasteIssue', "The issue text was copied to the clipboard.  Please paste it into this window."));
}

function createNewIssueLinkFromBody(issueBody: string): string {
    const { extensionName, bugsUrl } = getPackageInfo();
    const baseUrl: string = bugsUrl || `https://github.com/Microsoft/${extensionName}/issues`;
    return `${baseUrl}/new?body=${encodeURIComponent(issueBody)}`;
}

function createBodyDetail(detailName: string, detail: string): string {
    return `

<details>
<summary>${detailName}</summary>

\`\`\`
${detail}
\`\`\`

</details>
`;
}
