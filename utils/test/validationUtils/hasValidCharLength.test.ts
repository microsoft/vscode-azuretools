/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { validationUtils } from '../../src/utils/validationUtils';

type CharLengthParams = {
    value: string;
    constraints?: validationUtils.RangeConstraints;
};

export function hasValidCharLengthTest() {
    const trueValues: CharLengthParams[] = [
        { value: 'test' },
        { value: 'abcdef', constraints: { lowerLimitIncl: undefined, upperLimitIncl: 10 } },
        { value: 'abcdefghijklmnopqrstuvwxyz', constraints: { lowerLimitIncl: 1 } },
        { value: 'a', constraints: { lowerLimitIncl: 1, upperLimitIncl: 10 } },
        { value: '1234567890', constraints: { lowerLimitIncl: 1, upperLimitIncl: 10 } },
        { value: 'abcd', constraints: { lowerLimitIncl: 1, upperLimitIncl: 10 } },
    ];

    for (const { value, constraints } of trueValues) {
        assert.equal(validationUtils.hasValidCharLength(value, constraints), true);
    }

    const falseValues: CharLengthParams[] = [
        { value: '' },
        { value: '', constraints: { lowerLimitIncl: 0, upperLimitIncl: 1 } },
        { value: 'abc', constraints: { lowerLimitIncl: 4, upperLimitIncl: 10 } },
        { value: '12345678901', constraints: { lowerLimitIncl: 1, upperLimitIncl: 10 } },
    ];

    for (const { value, constraints } of falseValues) {
        assert.equal(validationUtils.hasValidCharLength(value, constraints), false);
    }

    const errorValues: CharLengthParams[] = [
        { value: 'abcd', constraints: { lowerLimitIncl: -1, upperLimitIncl: 4 } },
        { value: 'abcd', constraints: { lowerLimitIncl: 1, upperLimitIncl: -4 } },
        { value: 'abcd', constraints: { lowerLimitIncl: 5, upperLimitIncl: 4 } },
    ];

    for (const { value, constraints } of errorValues) {
        assert.throws(() => validationUtils.hasValidCharLength(value, constraints));
    }
}
