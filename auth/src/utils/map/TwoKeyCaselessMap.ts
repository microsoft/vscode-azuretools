/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CaselessMap } from './CaselessMap';

export class TwoKeyCaselessMap<V> implements Iterable<[string, string, V]> {
    #map1 = new CaselessMap<CaselessMap<V>>(); // First map has key1 as the outer key and key2 as the inner key
    #map2 = new CaselessMap<CaselessMap<V>>(); // Second key map has key2 as the outer key and key1 as the inner key
    #size = 0;

    public constructor(private readonly testMode: boolean = false) {
    }

    clear(): void {
        this.#map1.clear();
        this.#map2.clear();
        this.#size = 0;
    }

    clearByFirstKey(key1: string): void {
        const innerMap1 = this.#map1.get(key1);
        if (!innerMap1) {
            return;
        }

        // Decrement size before any deletions
        this.#size -= innerMap1.size;

        // Remove all entries from #map2 that reference this key1
        innerMap1.forEach((_, key2) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The existence of innerMap1 ensures this is non-null
            const innerMap2 = this.#map2.get(key2)!;
            innerMap2.delete(key1);
            if (innerMap2.size === 0) {
                this.#map2.delete(key2);
            }
        });

        // Remove the entire inner map from #map1
        this.#map1.delete(key1);
    }

    clearBySecondKey(key2: string): void {
        const innerMap2 = this.#map2.get(key2);
        if (!innerMap2) {
            return;
        }

        // Decrement size before any deletions
        this.#size -= innerMap2.size;

        // Remove all entries from #map1 that reference this key2
        innerMap2.forEach((_, key1) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The existence of innerMap2 ensures this is non-null
            const innerMap1 = this.#map1.get(key1)!;
            innerMap1.delete(key2);
            if (innerMap1.size === 0) {
                this.#map1.delete(key1);
            }
        });

        // Remove the entire inner map from #map2
        this.#map2.delete(key2);
    }

    delete(key1: string, key2: string): boolean {
        if (!this.has(key1, key2)) {
            return false;
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The has() check above ensures non-null
        const innerMap1 = this.#map1.get(key1)!;
        innerMap1.delete(key2);
        if (innerMap1.size === 0) {
            this.#map1.delete(key1);
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The has() check above ensures non-null
        const innerMap2 = this.#map2.get(key2)!;
        innerMap2.delete(key1);
        if (innerMap2.size === 0) {
            this.#map2.delete(key2);
        }

        this.#size--;
        return true;
    }

    /**
     * @important Keys returned **match original case**!
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Must exactly match interface
    forEach(callbackfn: (value: V, key1: string, key2: string) => void, thisArg?: any): void {
        this.#map1.forEach((innerMap1, key1) => {
            innerMap1.forEach((value, key2) => {
                callbackfn.call(thisArg, value, key1, key2);
            });
        });
    }

    get(key1: string, key2: string): V | undefined {
        return this.#map1.get(key1)?.get(key2);
    }

    has(key1: string, key2: string): boolean {
        const result1 = this.#map1.get(key1)?.has(key2);

        if (this.testMode) {
            const result2 = this.#map2.get(key2)?.has(key1);
            if (!!result1 !== !!result2) {
                throw new Error('Inconsistent state in TwoKeyCaselessMap');
            }
        }

        return result1 ?? false;
    }

    set(key1: string, key2: string, value: V): this {
        const alreadyHadEntry = this.has(key1, key2);

        let innerMap1 = this.#map1.get(key1);
        if (!innerMap1) {
            innerMap1 = new CaselessMap<V>();
            this.#map1.set(key1, innerMap1);
        }
        innerMap1.set(key2, value);

        let innerMap2 = this.#map2.get(key2);
        if (!innerMap2) {
            innerMap2 = new CaselessMap<V>();
            this.#map2.set(key2, innerMap2);
        }
        innerMap2.set(key1, value);

        if (!alreadyHadEntry) {
            this.#size++;
        }

        return this;
    }

    get size(): number {
        return this.#size;
    }

    /**
     * @important Keys returned **match original case**!
     */
    entriesByFirstKey(key1: string): MapIterator<[string, V]> {
        return this.#map1.get(key1)?.entries() ?? emptyIterator();
    }

    /**
     * @important Keys returned **match original case**!
     */
    entriesBySecondKey(key2: string): MapIterator<[string, V]> {
        return this.#map2.get(key2)?.entries() ?? emptyIterator();
    }

    /**
     * @important Keys returned **match original case**!
     */
    *entries(): MapIterator<[string, string, V]> {
        for (const [key1, innerMap1] of this.#map1) {
            for (const [key2, value] of innerMap1) {
                yield [key1, key2, value];
            }
        }
    }

    /**
     * @important Keys returned **match original case**!
     */
    keysByFirstKey(key1: string): MapIterator<string> {
        return this.#map1.get(key1)?.keys() ?? emptyIterator();
    }

    /**
     * @important Keys returned **match original case**!
     */
    keysBySecondKey(key2: string): MapIterator<string> {
        return this.#map2.get(key2)?.keys() ?? emptyIterator();
    }

    /**
     * @important Keys returned **match original case**!
     */
    *keys(): MapIterator<[string, string]> {
        for (const [key1, innerMap1] of this.#map1) {
            for (const key2 of innerMap1.keys()) {
                yield [key1, key2];
            }
        }
    }

    valuesByFirstKey(key1: string): MapIterator<V> {
        return this.#map1.get(key1)?.values() ?? emptyIterator();
    }

    valuesBySecondKey(key2: string): MapIterator<V> {
        return this.#map2.get(key2)?.values() ?? emptyIterator();
    }

    *values(): MapIterator<V> {
        for (const innerMap1 of this.#map1.values()) {
            for (const value of innerMap1.values()) {
                yield value;
            }
        }
    }

    /**
     * @important Keys returned **match original case**!
     */
    [Symbol.iterator](): MapIterator<[string, string, V]> {
        return this.entries();
    }

    readonly [Symbol.toStringTag]: string = 'TwoKeyCaselessMap';
}

function emptyIterator<T>(): MapIterator<T> {
    return [][Symbol.iterator]();
}
