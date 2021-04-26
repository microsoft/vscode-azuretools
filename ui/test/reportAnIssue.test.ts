/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { env } from 'vscode';
import { IParsedError } from '..';
import { getReportAnIssueLink, maxUrlLength } from '../src/reportAnIssue';

suite('getReportAnIssueLink', () => {
    const pasteIntoWindowBody: string = "https://github.com/Microsoft/azureextensionui/issues/new?body=The%20issue%20text%20was%20copied%20to%20the%20clipboard.%20%20Please%20paste%20it%20into%20this%20window.";

    test('Short stack, entire body should be in link', async () => {
        const message: string = 'This is a "message"?';
        const error: IParsedError = {
            errorType: 'error Type',
            isUserCancelledError: false,
            message: message,
            stack: createStack(1)
        };

        const link: string = await getReportAnIssueLink({ callbackId: 'actionId', time: Date.now(), error, issueProperties: {} });

        assert(link.length <= maxUrlLength);
        assert.notEqual(link, pasteIntoWindowBody);
        assert(linkIncludes(link, "Action: actionId"));
        assert(linkIncludes(link, message));
        assert(linkIncludes(link, 'Call Stack'));
        assert(linkIncludes(link, 'Stack line #1'));
        assert(!linkIncludes(link, '...'));
    });

    test('Long stack - should copy body to clipboard', async () => {
        const message: string = 'This is a "message"?';
        const error: IParsedError = {
            errorType: 'error Type',
            isUserCancelledError: false,
            message: message,
            stack: createStack(maxUrlLength) // definitely too long :-)
        };

        const link: string = await getReportAnIssueLink({ callbackId: 'actionId', time: Date.now(), error, issueProperties: {}/*asdf*/ });

        assert(link.length <= maxUrlLength);
        assert.equal(link, pasteIntoWindowBody);

        const body: string = await env.clipboard.readText();
        assert(body.includes("Action: actionId"));
        assert(body.includes(message));
        assert(body.includes('Call Stack'));
        assert(body.includes('Stack line #1'));
    });

    test('message long - should copy body to clipboard', async () => {
        const message: string = 'x'.repeat(maxUrlLength);
        const error: IParsedError = {
            errorType: 'error Type',
            isUserCancelledError: false,
            message: message,
            stack: undefined
        };

        const link: string = await getReportAnIssueLink({ callbackId: 'actionId', time: Date.now(), error, issueProperties: {} });

        assert.equal(link, pasteIntoWindowBody);

        const body: string = await env.clipboard.readText();
        assert(body.includes("Action: actionId"));
        assert(body.includes(message));
    });

    suite("issueProperties", () => {
        test('single property', async () => {
            const message: string = "This is my message";
            const error: IParsedError = {
                errorType: 'error Type',
                isUserCancelledError: false,
                message: message,
                stack: undefined
            };

            const link: string = await getReportAnIssueLink({ callbackId: 'actionId', time: Date.now(), error, issueProperties: { property1: "Property #1" } });

            assert(linkIncludes(link, "property1"));
            assert(linkIncludes(link, "Property #1"));
        });

        test('multiple properties', async () => {
            const message: string = "This is my message";
            const error: IParsedError = {
                errorType: 'error Type',
                isUserCancelledError: false,
                message: message,
                stack: undefined
            };

            const link: string = await getReportAnIssueLink({ callbackId: 'actionId', time: Date.now(), error, issueProperties: { property1: "Property #1", property2: "Property #2" } });

            assert(linkIncludes(link, "property1"));
            assert(linkIncludes(link, "Property #1"));
            assert(linkIncludes(link, "property2"));
            assert(linkIncludes(link, "Property #2"));
        });

        test('multiple properties and stack', async () => {
            const message: string = "This is my message";
            const error: IParsedError = {
                errorType: 'error Type',
                isUserCancelledError: false,
                message: message,
                stack: createStack(1)
            };

            const link: string = await getReportAnIssueLink({ callbackId: 'actionId', time: Date.now(), error, issueProperties: { property1: "Property #1", property2: "Property #2" } });

            assert(linkIncludes(link, "property1"));
            assert(linkIncludes(link, "Property #1"));
            assert(linkIncludes(link, "property2"));
            assert(linkIncludes(link, "Property #2"));
            assert(linkIncludes(link, "Stack line #1"));
        });
    });
});

function createStack(lines: number): string {
    const entries: string[] = [];

    for (let i: number = 0; i < lines; i += 1) {
        entries[i] = `Stack line #${i + 1}`;
    }

    return entries.join('\r\n');
}

function linkIncludes(link: string, substring: string): boolean {
    return (link.includes(encodeURIComponent(substring)));
}
