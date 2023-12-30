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
        { value: 'test' }, // No limits specified
        { value: 'abcdef', constraints: { lowerLimitIncl: undefined, upperLimitIncl: 10 } }, // No lower limit specified
        { value: 'abcdefghijklmnopqrstuvwxyz', constraints: { lowerLimitIncl: 1 } }, // No upper limit specified
        { value: 'a', constraints: { lowerLimitIncl: 1, upperLimitIncl: 10 } },  // At lower limit
        { value: '1234567890', constraints: { lowerLimitIncl: 1, upperLimitIncl: 10 } }, // At upper limit
        { value: 'abcd', constraints: { lowerLimitIncl: 1, upperLimitIncl: 10 } }, // Within limits
    ];

    for (const { value, constraints } of trueValues) {
        assert.equal(validationUtils.hasValidCharLength(value, constraints), true);
    }

    const falseValues: CharLengthParams[] = [
        { value: '' },
        { value: '', constraints: { lowerLimitIncl: 0, upperLimitIncl: 1 } }, // Lower limit != 0
        { value: 'abcdefg', constraints: { lowerLimitIncl: 5, upperLimitIncl: -5 } },  // Lower limit > upper limit
        { value: 'abc', constraints: { lowerLimitIncl: 4, upperLimitIncl: 10 } }, // Below limit
        { value: '12345678901', constraints: { lowerLimitIncl: 1, upperLimitIncl: 10 } },  // Above limit
    ];

    for (const { value, constraints } of falseValues) {
        assert.equal(validationUtils.hasValidCharLength(value, constraints), false);
    }
}
