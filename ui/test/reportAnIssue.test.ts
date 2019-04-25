/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable: max-func-body-length

import * as assert from 'assert';
import { IParsedError } from '..';
import { getReportAnIssueLink, maxUrlLength } from '../src/reportAnIssue';

suite('getReportAnIssueLink', () => {
    test('message too long, no stack', () => {
        const message: string = 'x'.repeat(maxUrlLength);
        const pe: IParsedError = {
            errorType: 'error Type',
            isUserCancelledError: false,
            message: message,
            stack: undefined
        };

        const link: string = getReportAnIssueLink('actionId', pe);
        assert(link.length <= maxUrlLength);
        assert(linkIncludes(link, '...'));
    });

    test('message too long, with stack', () => {
        const message: string = '#?x '.repeat(maxUrlLength);
        const pe: IParsedError = {
            errorType: 'error Type',
            isUserCancelledError: false,
            message: message,
            stack: createStack(10)
        };

        const link: string = getReportAnIssueLink('actionId', pe);
        assert(link.length <= maxUrlLength);
        assert(!linkIncludes(link, 'Stack line'));
        assert(linkIncludes(link, '...'));
    });

    test('no stack', () => {
        const message: string = 'This is a "message"?';
        const pe: IParsedError = {
            errorType: 'error Type',
            isUserCancelledError: false,
            message: message,
            stack: undefined
        };

        const link: string = getReportAnIssueLink('actionId', pe);
        assert(link.length <= maxUrlLength);
        assert(linkIncludes(link, message));
        assert(!linkIncludes(link, 'Call Stack'));
        assert(!linkIncludes(link, '...'));
    });

    test('empty stack', () => {
        const message: string = 'This is a "message"?';
        const pe: IParsedError = {
            errorType: 'error Type',
            isUserCancelledError: false,
            message: message,
            stack: ''
        };

        const link: string = getReportAnIssueLink('actionId', pe);
        assert(link.length <= maxUrlLength);
        assert(linkIncludes(link, message));
        assert(!linkIncludes(link, 'Call Stack'));
        assert(!linkIncludes(link, '...'));
    });

    test('Short stack', () => {
        const message: string = 'This is a "message"?';
        const pe: IParsedError = {
            errorType: 'error Type',
            isUserCancelledError: false,
            message: message,
            stack: createStack(1)
        };

        const link: string = getReportAnIssueLink('actionId', pe);
        assert(link.length <= maxUrlLength);
        assert(linkIncludes(link, message));
        assert(linkIncludes(link, 'Call Stack'));
        assert(linkIncludes(link, 'Stack line #1'));
        assert(!linkIncludes(link, '...'));
    });

    test('Short stack 2', () => {
        const message: string = 'This is a "message"?';
        const pe: IParsedError = {
            errorType: 'error Type',
            isUserCancelledError: false,
            message: message,
            stack: createStack(2)
        };

        const link: string = getReportAnIssueLink('actionId', pe);
        assert(link.length <= maxUrlLength);
        assert(linkIncludes(link, message));
        assert(linkIncludes(link, 'Call Stack'));
        assert(linkIncludes(link, 'Stack line #1'));
        assert(linkIncludes(link, 'Stack line #2'));
        assert(!linkIncludes(link, '...'));
    });

    test('Long stack', () => {
        const message: string = 'This is a "message"?';
        const pe: IParsedError = {
            errorType: 'error Type',
            isUserCancelledError: false,
            message: message,
            stack: createStack(maxUrlLength) // definitely too long :-)
        };

        const link: string = getReportAnIssueLink('actionId', pe);
        assert(link.length <= maxUrlLength);
        assert(linkIncludes(link, message));
        assert(linkIncludes(link, 'Call Stack'));
        assert(linkIncludes(link, 'Stack line #1'));
        assert(!linkIncludes(link, '...'));
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
