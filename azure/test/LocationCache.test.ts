/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { LocationCache } from '../src/wizard/LocationCache';

suite('LocationCache', () => {
    let cache: LocationCache;

    setup(() => {
        cache = new LocationCache();
    });

    test('returns data from loader on cache miss', async () => {
        const result = await cache.getOrLoad('key1', async () => ['eastus', 'westus']);
        assert.deepStrictEqual(result, ['eastus', 'westus']);
    });

    test('returns cached data on subsequent calls without calling loader again', async () => {
        let callCount = 0;
        const loader = async () => {
            callCount++;
            return ['eastus'];
        };

        const result1 = await cache.getOrLoad('key1', loader);
        const result2 = await cache.getOrLoad('key1', loader);

        assert.deepStrictEqual(result1, ['eastus']);
        assert.deepStrictEqual(result2, ['eastus']);
        assert.strictEqual(callCount, 1, 'loader should only be called once');
    });

    test('uses separate entries for different keys', async () => {
        await cache.getOrLoad('sub1|false', async () => ['eastus']);
        await cache.getOrLoad('sub2|false', async () => ['westus']);

        const result1 = await cache.getOrLoad('sub1|false', async () => { throw new Error('should not call'); });
        const result2 = await cache.getOrLoad('sub2|false', async () => { throw new Error('should not call'); });

        assert.deepStrictEqual(result1, ['eastus']);
        assert.deepStrictEqual(result2, ['westus']);
    });

    test('deduplicates concurrent in-flight requests for the same key', async () => {
        let callCount = 0;
        let resolve: (value: string[]) => void;
        const loader = () => {
            callCount++;
            return new Promise<string[]>(r => { resolve = r; });
        };

        const p1 = cache.getOrLoad('key1', loader);
        const p2 = cache.getOrLoad('key1', loader);

        // Both should be waiting on the same promise
        assert.strictEqual(callCount, 1, 'loader should only be called once for concurrent requests');

        resolve!(['eastus']);
        const [result1, result2] = await Promise.all([p1, p2]);

        assert.deepStrictEqual(result1, ['eastus']);
        assert.deepStrictEqual(result2, ['eastus']);
    });

    test('clear removes all cached entries', async () => {
        let callCount = 0;
        const loader = async () => {
            callCount++;
            return ['eastus'];
        };

        await cache.getOrLoad('key1', loader);
        assert.strictEqual(callCount, 1);

        cache.clear();

        await cache.getOrLoad('key1', loader);
        assert.strictEqual(callCount, 2, 'loader should be called again after clear');
    });

    test('expired entries are refreshed', async () => {
        // Use a very short TTL
        const shortCache = new LocationCache(1);
        let callCount = 0;
        const loader = async () => {
            callCount++;
            return [`result-${callCount}`];
        };

        const result1 = await shortCache.getOrLoad('key1', loader);
        assert.deepStrictEqual(result1, ['result-1']);

        // Wait for expiry
        await new Promise(r => setTimeout(r, 10));

        const result2 = await shortCache.getOrLoad('key1', loader);
        assert.deepStrictEqual(result2, ['result-2']);
        assert.strictEqual(callCount, 2, 'loader should be called again after expiry');
    });

    test('entries without TTL never expire', async () => {
        // Default constructor has no TTL
        let callCount = 0;

        await cache.getOrLoad('key1', async () => { callCount++; return ['eastus']; });
        await cache.getOrLoad('key1', async () => { callCount++; return ['westus']; });

        assert.strictEqual(callCount, 1);
    });

    test('loader error does not poison the cache', async () => {
        let shouldFail = true;
        const loader = async () => {
            if (shouldFail) {
                throw new Error('network error');
            }
            return ['eastus'];
        };

        await assert.rejects(() => cache.getOrLoad('key1', loader), /network error/);

        shouldFail = false;
        const result = await cache.getOrLoad('key1', loader);
        assert.deepStrictEqual(result, ['eastus']);
    });

    test('loader error is propagated to all concurrent waiters', async () => {
        let reject: (err: Error) => void;
        const loader = () => new Promise<string[]>((_, r) => { reject = r; });

        const p1 = cache.getOrLoad('key1', loader);
        const p2 = cache.getOrLoad('key1', loader);

        reject!(new Error('boom'));

        await assert.rejects(() => p1, /boom/);
        await assert.rejects(() => p2, /boom/);
    });

    test('after error, a new loader call succeeds', async () => {
        let callCount = 0;
        const failLoader = async () => { callCount++; throw new Error('fail'); };
        const okLoader = async () => { callCount++; return ['eastus']; };

        await assert.rejects(() => cache.getOrLoad('key1', failLoader), /fail/);
        const result = await cache.getOrLoad('key1', okLoader);

        assert.deepStrictEqual(result, ['eastus']);
        assert.strictEqual(callCount, 2);
    });
});
