/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assert } from 'chai';
import { getDefaultScopeFromEndpoint } from '../../src/utils/BearerChallengePolicy';

suite('(unit) getDefaultScopeFromEndpoint()', () => {
    test('uses the default management endpoint', () => {
        assert.strictEqual(getDefaultScopeFromEndpoint(), 'https://management.azure.com/.default');
    });

    test('removes only trailing slashes', () => {
        for (const endpoint of ['https://example.com', 'https://example.com/', 'https://example.com////']) {
            assert.strictEqual(getDefaultScopeFromEndpoint(endpoint), 'https://example.com/.default');
        }
        assert.strictEqual(getDefaultScopeFromEndpoint('https://example.com//path'), 'https://example.com//path/.default');
        assert.strictEqual(getDefaultScopeFromEndpoint(''), '/.default');
        assert.strictEqual(getDefaultScopeFromEndpoint('////'), '/.default');
    });

    test('handles long slash sequences, including nonmatching suffixes', () => {
        const slashes = '/'.repeat(100000);
        assert.strictEqual(getDefaultScopeFromEndpoint(slashes), '/.default');
        assert.strictEqual(getDefaultScopeFromEndpoint(`${slashes}x`), `${slashes}x/.default`);
    });
});
