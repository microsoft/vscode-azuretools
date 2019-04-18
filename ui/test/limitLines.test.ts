// tslint:disable no-useless-files

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* disable temporarily for extension activation hotfix
import * as assert from 'assert';
import { limitLines } from '../src/utils/limitLines';

suite('limitLines', () => {
    function testLimitLines(testName: string, s: string, n: number, expected: string): void {
        test(testName, () => {
            const result: string = limitLines(s, n);
            assert.strictEqual(result, expected);
        });
    }

    testLimitLines('empty', '', 10, '');
    testLimitLines('one line 1', 'one line', 1, 'one line');
    testLimitLines('one line 2', 'one line', 2, 'one line');
    testLimitLines('two lines 1 \\n', 'line 1\nline 2', 1, 'line 1');
    testLimitLines('two lines 1 \\r\\n', 'line 1\r\nline 2', 1, 'line 1');
    testLimitLines('two lines 2 \\n', 'line 1\nline 2', 2, 'line 1\nline 2');
    testLimitLines('two lines 2 \\r\\n', 'line 1\r\nline 2', 2, 'line 1\r\nline 2');
    testLimitLines('two lines 3 \\r\\n', 'line 1\r\nline 2', 3, 'line 1\r\nline 2');
    testLimitLines('three lines 2', 'line 1\nline 2\nline 3', 2, 'line 1\nline 2');
    testLimitLines('three lines 4', 'line 1\nline 2\nline 3', 4, 'line 1\nline 2\nline 3');
});
 */
