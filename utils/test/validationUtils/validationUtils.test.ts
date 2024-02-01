/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getInvalidCharLengthMessageTest } from "./getInvalidCharLengthMessage.test";
import { hasValidCharLengthTest } from "./hasValidCharLength.test";

suite('validationUtils', () => {
    // General
    test('hasValidCharLength', hasValidCharLengthTest);
    test('getInvalidCharLengthMessage', getInvalidCharLengthMessageTest);
    // test('hasValidAlphanumericAndSymbols', hasValidAlphanumericAndSymbolsTest);
    // test('getInvalidAlphanumericAndSymbolsMessage', getInvalidAlphanumericAndSymbolsMessageTest);

    // Numeric
    // test('hasValidNumericFormat', hasValidNumericFormatTest);
    // test('getInvalidNumericFormatMessage', getInvalidNumericFormatMessageTest);
    // test('hasValidNumericValue', hasValidNumericValueTest);
    // test('getInvalidNumericValueMessage', getInvalidNumericValueMessageTest);
});
