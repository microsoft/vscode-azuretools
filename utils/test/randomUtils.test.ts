/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import { randomUtils } from '../src/utils/randomUtils';


suite('randomUtils', function (this: Mocha.Suite): void {
    test('getRandomHexString', async () => {
        // An even number length
        assert.strictEqual(randomUtils.getRandomHexString(6).length, 6);

        // An odd number length
        assert.strictEqual(randomUtils.getRandomHexString(5).length, 5);

        // Zero length should throw
        assert.throws(() => randomUtils.getRandomHexString(0));
    });
});
