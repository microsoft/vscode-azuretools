/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { validationUtils } from '../../src/utils/validationUtils';

type CharLengthMessageParams = {
    output: string;
    constraints?: validationUtils.RangeConstraints;
};

export function getInvalidCharLengthMessageTest() {
    const parameterList: CharLengthMessageParams[] = [
        { output: 'A value is required to proceed.' },
        { output: 'The value must be 5 characters or greater.', constraints: { lowerLimitIncl: 5 } },
        { output: 'The value must be 5 characters or less.', constraints: { upperLimitIncl: 5 } },
        { output: 'The value must be 5 characters long.', constraints: { lowerLimitIncl: 5, upperLimitIncl: 5 } },
        { output: 'The value must be between 2 and 5 characters long.', constraints: { lowerLimitIncl: 2, upperLimitIncl: 5 } },
    ];

    for (const { output, constraints } of parameterList) {
        assert.equal(validationUtils.getInvalidCharLengthMessage(constraints), output);
    }
}
