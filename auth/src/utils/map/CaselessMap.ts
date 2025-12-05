/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

type CaselessMapEntry<V> = {
    originalKey: string; // Store original key alongside value
    value: V;
};

export class CaselessMap<V> implements Map<string, V> {
    #map = new Map<string, CaselessMapEntry<V>>();

    clear(): void {
        this.#map.clear();
    }

    delete(key: string): boolean {
        return this.#map.delete(this.normalizeKey(key));
    }

    /**
     * @important Keys returned **match original case**!
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Must exactly match interface
    forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void, thisArg?: any): void {
        this.#map.forEach(entry => {
            callbackfn.call(thisArg, entry.value, entry.originalKey, this);
        });
    }

    get(key: string): V | undefined {
        return this.#map.get(this.normalizeKey(key))?.value;
    }

    has(key: string): boolean {
        return this.#map.has(this.normalizeKey(key));
    }

    set(key: string, value: V): this {
        this.#map.set(this.normalizeKey(key), { originalKey: key, value });
        return this;
    }

    get size(): number {
        return this.#map.size;
    }

    /**
     * @important Keys returned **match original case**!
     */
    *entries(): MapIterator<[string, V]> {
        for (const [, entry] of this.#map) {
            yield [entry.originalKey, entry.value];
        }
    }

    /**
     * @important Keys returned **match original case**!
     */
    *keys(): MapIterator<string> {
        for (const [, entry] of this.#map) {
            yield entry.originalKey;
        }
    }

    *values(): MapIterator<V> {
        for (const [, entry] of this.#map) {
            yield entry.value;
        }
    }

    /**
     * @important Keys returned **match original case**!
     */
    [Symbol.iterator](): MapIterator<[string, V]> {
        return this.entries();
    }

    readonly [Symbol.toStringTag]: string = 'CaselessMap';

    private normalizeKey(key: string): string {
        return key.toLowerCase();
    }
}
