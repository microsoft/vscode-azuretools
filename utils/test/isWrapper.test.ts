/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Wrapper } from '..';
import { isWrapper } from '../src/registerCommandWithTreeNodeUnwrapping';

suite('isWrapper', () => {

    test('Not a Wrapper', () => {
        assert.strictEqual(isWrapper(undefined), false);
        assert.strictEqual(isWrapper(null), false);
        assert.strictEqual(isWrapper(1), false);
        assert.strictEqual(isWrapper(false), false);
        assert.strictEqual(isWrapper('foo'), false);
        assert.strictEqual(isWrapper({}), false);
        assert.strictEqual(isWrapper({ unwrap: false }), false);
    });

    test('Wrapper', () => {
        const actualWrapper: Wrapper = {
            unwrap: <T>() => { return undefined as unknown as T },
        };

        assert.strictEqual(isWrapper(actualWrapper), true);
    });

});
