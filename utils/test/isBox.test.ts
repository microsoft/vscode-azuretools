/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Box } from '../hostapi';
import { isBox } from '../src/registerCommandWithTreeNodeUnboxing';

suite('isBox', () => {

    test('Not a box', () => {
        assert.strictEqual(isBox(undefined), false);
        assert.strictEqual(isBox(null), false);
        assert.strictEqual(isBox(1), false);
        assert.strictEqual(isBox(false), false);
        assert.strictEqual(isBox('foo'), false);
        assert.strictEqual(isBox({}), false);
        assert.strictEqual(isBox({ unwrap: false }), false);
    });

    test('Box', () => {
        const actualBox: Box = {
            unwrap: <T>() => { return Promise.resolve(undefined as unknown as T) },
        };

        assert.strictEqual(isBox(actualBox), true);
    });

});
