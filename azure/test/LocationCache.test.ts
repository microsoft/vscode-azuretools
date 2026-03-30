/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { LocationCache } from '../src/wizard/LocationCache';

suite('LocationCache', () => {
    let cache: LocationCache<string[]>;

    setup(() => {
        cache = new LocationCache();
    });

    test('returns data from loader on cache miss', async () => {
        const result = await cache.getOrLoad('key1', () => Promise.resolve(['eastus', 'westus']));
        assert.deepStrictEqual(result, ['eastus', 'westus']);
    });

    test('returns cached data on subsequent calls without calling loader again', async () => {
        let callCount = 0;
        const loader = () => {
            callCount++;
            return Promise.resolve(['eastus']);
        };

        const result1 = await cache.getOrLoad('key1', loader);
        const result2 = await cache.getOrLoad('key1', loader);

        assert.deepStrictEqual(result1, ['eastus']);
        assert.deepStrictEqual(result2, ['eastus']);
        assert.strictEqual(callCount, 1, 'loader should only be called once');
    });

    test('uses separate entries for different keys', async () => {
        await cache.getOrLoad('sub1|false', () => Promise.resolve(['eastus']));
        await cache.getOrLoad('sub2|false', () => Promise.resolve(['westus']));

        const result1 = await cache.getOrLoad('sub1|false', () => Promise.reject(new Error('should not call')));
        const result2 = await cache.getOrLoad('sub2|false', () => Promise.reject(new Error('should not call')));

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
        const loader = () => {
            callCount++;
            return Promise.resolve(['eastus']);
        };

        await cache.getOrLoad('key1', loader);
        assert.strictEqual(callCount, 1);

        cache.clear();

        await cache.getOrLoad('key1', loader);
        assert.strictEqual(callCount, 2, 'loader should be called again after clear');
    });

    test('clear prevents in-flight requests from repopulating the cache', async () => {
        let resolve: (value: string[]) => void;
        const loader = () => new Promise<string[]>(r => { resolve = r; });

        const p1 = cache.getOrLoad('key1', loader);

        // Clear while the request is still in-flight
        cache.clear();

        // Resolve the stale request
        resolve!(['stale']);
        await p1;

        // The stale result should NOT have been cached, so a new loader fires
        let callCount = 0;
        await cache.getOrLoad('key1', () => { callCount++; return Promise.resolve(['fresh']); });
        assert.strictEqual(callCount, 1, 'loader should be called because stale result was not cached');
    });

    test('expired entries are refreshed (injectable clock)', async () => {
        let time = 1000;
        const clock = () => time;
        const ttlCache = new LocationCache<string[]>(100, clock);

        let callCount = 0;
        const loader = () => {
            callCount++;
            return Promise.resolve([`result-${callCount}`]);
        };

        const result1 = await ttlCache.getOrLoad('key1', loader);
        assert.deepStrictEqual(result1, ['result-1']);

        // Advance past TTL
        time = 1200;

        const result2 = await ttlCache.getOrLoad('key1', loader);
        assert.deepStrictEqual(result2, ['result-2']);
        assert.strictEqual(callCount, 2, 'loader should be called again after expiry');
    });

    test('entries without TTL never expire', async () => {
        let callCount = 0;

        await cache.getOrLoad('key1', () => { callCount++; return Promise.resolve(['eastus']); });
        await cache.getOrLoad('key1', () => { callCount++; return Promise.resolve(['westus']); });

        assert.strictEqual(callCount, 1);
    });

    test('loader error does not poison the cache', async () => {
        let shouldFail = true;
        const loader = () => {
            if (shouldFail) {
                return Promise.reject(new Error('network error'));
            }
            return Promise.resolve(['eastus']);
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
        const failLoader = () => { callCount++; return Promise.reject(new Error('fail')); };
        const okLoader = () => { callCount++; return Promise.resolve(['eastus']); };

        await assert.rejects(() => cache.getOrLoad('key1', failLoader), /fail/);
        const result = await cache.getOrLoad('key1', okLoader);

        assert.deepStrictEqual(result, ['eastus']);
        assert.strictEqual(callCount, 2);
    });

    test('synchronous throw from loader is handled', async () => {
        const loader = (): Promise<string[]> => { throw new Error('sync boom'); };

        await assert.rejects(() => cache.getOrLoad('key1', loader), /sync boom/);

        // Cache should not be poisoned
        const result = await cache.getOrLoad('key1', () => Promise.resolve(['eastus']));
        assert.deepStrictEqual(result, ['eastus']);
    });
});
