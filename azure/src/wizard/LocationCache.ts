/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * A simple cache that deduplicates in-flight requests.
 *
 * Currently backed by an in-memory Map. Designed so the backing store can be
 * swapped to persistent storage (e.g. `vscode.Memento` / globalState) in the
 * future to survive across VS Code restarts with a longer TTL (e.g. 7 days).
 */

interface CacheEntry<T> {
    data: T;
    /** Unix timestamp (ms) when this entry was stored */
    storedAt: number;
}

export class LocationCache<T> {
    private readonly cache = new Map<string, CacheEntry<T>>();

    /**
     * In-flight promises keyed the same way as the cache.
     * Ensures concurrent callers share the same request instead of firing duplicates.
     */
    private readonly inflight = new Map<string, Promise<T>>();

    /**
     * Monotonically increasing counter incremented on each {@link clear} call.
     * In-flight requests captured before a clear will see a stale generation
     * and skip writing their result back into the cache.
     */
    private generation = 0;

    /**
     * @param ttlMs Optional time-to-live in milliseconds. When omitted, entries
     * never expire (suitable for in-memory caches that reset on extension
     * deactivation). Set this when switching to persistent storage.
     * @param now Clock function used for TTL checks. Override in tests to avoid
     * real timers.
     */
    constructor(private readonly ttlMs?: number, private readonly now: () => number = Date.now) { }

    /**
     * Get a value from the cache, or fetch it if missing/expired.
     * Concurrent calls with the same key share a single in-flight request.
     */
    getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
        const cached = this.cache.get(key);
        if (cached && !this.isExpired(cached)) {
            return Promise.resolve(cached.data);
        }

        // Check for an in-flight request we can piggy-back on
        const existing = this.inflight.get(key);
        if (existing) {
            return existing;
        }

        const gen = this.generation;

        let loaderPromise: Promise<T>;
        try {
            loaderPromise = loader();
        } catch (err) {
            return Promise.reject(err);
        }

        const promise = loaderPromise.then(data => {
            if (this.generation === gen) {
                this.cache.set(key, { data, storedAt: this.now() });
            }
            this.inflight.delete(key);
            return data;
        }).catch(err => {
            this.inflight.delete(key);
            throw err;
        });

        this.inflight.set(key, promise);
        return promise;
    }

    /** Remove all cached entries. */
    clear(): void {
        this.cache.clear();
        this.generation++;
    }

    private isExpired(entry: CacheEntry<T>): boolean {
        return this.ttlMs !== undefined && (this.now() - entry.storedAt) > this.ttlMs;
    }
}
