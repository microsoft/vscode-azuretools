/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * A simple cache for location data that deduplicates in-flight requests.
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

export class LocationCache {
    private readonly cache = new Map<string, CacheEntry<unknown>>();

    /**
     * In-flight promises keyed the same way as the cache.
     * Ensures concurrent callers share the same request instead of firing duplicates.
     */
    private readonly inflight = new Map<string, Promise<unknown>>();

    /**
     * @param ttlMs Optional time-to-live in milliseconds. When omitted, entries
     * never expire (suitable for in-memory caches that reset on extension
     * deactivation). Set this when switching to persistent storage.
     */
    constructor(private readonly ttlMs?: number) { }

    /**
     * Get a value from the cache, or fetch it if missing/expired.
     * Concurrent calls with the same key share a single in-flight request.
     */
    async getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
        const cached = this.cache.get(key) as CacheEntry<T> | undefined;
        if (cached && !this.isExpired(cached)) {
            return cached.data;
        }

        // Check for an in-flight request we can piggy-back on
        const existing = this.inflight.get(key) as Promise<T> | undefined;
        if (existing) {
            return existing;
        }

        const promise = loader().then(data => {
            this.cache.set(key, { data, storedAt: Date.now() });
            this.inflight.delete(key);
            return data;
        }).catch(err => {
            this.inflight.delete(key);
            throw err;
        });

        this.inflight.set(key, promise);
        return promise;
    }

    /** Remove all entries (e.g. on sign-out or subscription change) */
    clear(): void {
        this.cache.clear();
        // Don't clear inflight — let pending requests finish naturally
    }

    private isExpired(entry: CacheEntry<unknown>): boolean {
        return this.ttlMs !== undefined && (Date.now() - entry.storedAt) > this.ttlMs;
    }
}

/**
 * Module-level caches shared across all wizard instances within the same
 * extension activation. Keyed by subscription ID (+ provider info for
 * provider locations).
 */
export const subscriptionLocationsCache = new LocationCache();
export const providerLocationsCache = new LocationCache();
