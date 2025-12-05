/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { CaselessMap } from '../../../src/utils/map/CaselessMap';

suite('(unit) CaselessMap', () => {
    suite('set get delete has', () => {
        test('set works case insensitively', () => {
            const map = new CaselessMap<string>();

            map.set('FooBar', 'value1');
            assert.strictEqual(map.get('foobar'), 'value1', 'lowercase key should retrieve value');
            assert.strictEqual(map.get('FOOBAR'), 'value1', 'uppercase key should retrieve value');
            assert.strictEqual(map.get('FooBar'), 'value1', 'mixed case key should retrieve value');
            assert.strictEqual(map.get('fOObAR'), 'value1', 'random case key should retrieve value');
        });

        test('set overwrites existing value with different case', () => {
            const map = new CaselessMap<number>();

            map.set('Key', 1);
            map.set('KEY', 2);
            map.set('key', 3);

            assert.strictEqual(map.size, 1, 'should only have one entry');
            assert.strictEqual(map.get('KEY'), 3, 'should have latest value');
            // The key returned should be the most recent one set
            assert.strictEqual(Array.from(map.keys())[0], 'key', 'should have latest key case');
        });

        test('key case is updated on each overwrite', () => {
            const map = new CaselessMap<string>();

            map.set('OriginalCase', 'value1');
            assert.strictEqual(Array.from(map.keys())[0], 'OriginalCase', 'should preserve original case');

            map.set('ORIGINALCASE', 'value2');
            assert.strictEqual(Array.from(map.keys())[0], 'ORIGINALCASE', 'should update to uppercase');

            map.set('originalcase', 'value3');
            assert.strictEqual(Array.from(map.keys())[0], 'originalcase', 'should update to lowercase');

            map.set('OrIgInAlCaSe', 'value4');
            assert.strictEqual(Array.from(map.keys())[0], 'OrIgInAlCaSe', 'should update to mixed case');

            // Verify all return the same value
            assert.strictEqual(map.get('OriginalCase'), 'value4');
            assert.strictEqual(map.get('ORIGINALCASE'), 'value4');
            assert.strictEqual(map.get('originalcase'), 'value4');
            assert.strictEqual(map.get('OrIgInAlCaSe'), 'value4');

            // Verify size stayed at 1
            assert.strictEqual(map.size, 1);
        });

        test('get returns undefined for non-existent key', () => {
            const map = new CaselessMap<string>();

            assert.strictEqual(map.get('nonexistent'), undefined);
            assert.strictEqual(map.get(''), undefined);
        });

        test('has works case insensitively', () => {
            const map = new CaselessMap<string>();

            map.set('TestKey', 'value');

            assert.strictEqual(map.has('testkey'), true);
            assert.strictEqual(map.has('TESTKEY'), true);
            assert.strictEqual(map.has('TestKey'), true);
            assert.strictEqual(map.has('tEsTkEy'), true);
            assert.strictEqual(map.has('nonexistent'), false);
        });

        test('delete works case insensitively', () => {
            const map = new CaselessMap<string>();

            map.set('DeleteMe', 'value');
            assert.strictEqual(map.has('DeleteMe'), true);

            const deleted = map.delete('deleteme');
            assert.strictEqual(deleted, true, 'delete should return true');
            assert.strictEqual(map.has('DeleteMe'), false, 'key should be gone');
            assert.strictEqual(map.size, 0, 'size should be 0');
        });

        test('delete returns false for non-existent key', () => {
            const map = new CaselessMap<string>();

            const deleted = map.delete('nonexistent');
            assert.strictEqual(deleted, false);
        });

        test('set returns this for chaining', () => {
            const map = new CaselessMap<string>();

            const result = map.set('key1', 'value1').set('key2', 'value2').set('key3', 'value3');

            assert.strictEqual(result, map, 'should return same instance');
            assert.strictEqual(map.size, 3);
        });

        test('handles empty string as key', () => {
            const map = new CaselessMap<string>();

            map.set('', 'empty');
            assert.strictEqual(map.get(''), 'empty');
            assert.strictEqual(map.has(''), true);
            assert.strictEqual(map.delete(''), true);
            assert.strictEqual(map.has(''), false);
        });

        test('handles special characters in keys case insensitively', () => {
            const map = new CaselessMap<string>();

            map.set('Key-With_Special.Chars!', 'value');
            assert.strictEqual(map.get('key-with_special.chars!'), 'value');
            assert.strictEqual(map.get('KEY-WITH_SPECIAL.CHARS!'), 'value');
        });

        test('handles unicode characters case insensitively', () => {
            const map = new CaselessMap<string>();

            map.set('Café', 'value');
            assert.strictEqual(map.get('café'), 'value');
            assert.strictEqual(map.get('CAFÉ'), 'value');
        });
    });

    suite('size', () => {
        test('size is 0 for empty map', () => {
            const map = new CaselessMap<string>();
            assert.strictEqual(map.size, 0);
        });

        test('size increases with set', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            assert.strictEqual(map.size, 1);

            map.set('key2', 'value2');
            assert.strictEqual(map.size, 2);

            map.set('key3', 'value3');
            assert.strictEqual(map.size, 3);
        });

        test('size does not increase when overwriting', () => {
            const map = new CaselessMap<string>();

            map.set('Key', 'value1');
            assert.strictEqual(map.size, 1);

            map.set('key', 'value2');
            assert.strictEqual(map.size, 1, 'size should still be 1');

            map.set('KEY', 'value3');
            assert.strictEqual(map.size, 1, 'size should still be 1');
        });

        test('size decreases with delete', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            map.set('key2', 'value2');
            assert.strictEqual(map.size, 2);

            map.delete('key1');
            assert.strictEqual(map.size, 1);

            map.delete('KEY2');
            assert.strictEqual(map.size, 0);
        });
    });

    suite('iterators', () => {
        test('keys() preserve original case', () => {
            const map = new CaselessMap<string>();

            map.set('FooBar', 'value1');
            map.set('BazQux', 'value2');
            map.set('ALLCAPS', 'value3');

            const keys = Array.from(map.keys()).sort();
            assert.deepStrictEqual(keys, ['ALLCAPS', 'BazQux', 'FooBar']);
        });

        test('entries() keys preserve original case', () => {
            const map = new CaselessMap<string>();

            map.set('MixedCase', 'value1');
            map.set('UPPERCASE', 'value2');

            const entries = Array.from(map.entries());
            assert.strictEqual(entries.length, 2);
            const keys = entries.map(([key]) => key).sort();
            assert.deepStrictEqual(keys, ['MixedCase', 'UPPERCASE']);
        });

        test('values() returns all values', () => {
            const map = new CaselessMap<number>();

            map.set('key1', 1);
            map.set('key2', 2);
            map.set('key3', 3);

            const values = Array.from(map.values()).sort();
            assert.deepStrictEqual(values, [1, 2, 3]);
        });

        test('Symbol.iterator keys preserve original case', () => {
            const map = new CaselessMap<string>();

            map.set('Key1', 'value1');
            map.set('Key2', 'value2');

            const entries = Array.from(map);
            assert.strictEqual(entries.length, 2);
            const keys = entries.map(([key]) => key).sort();
            assert.deepStrictEqual(keys, ['Key1', 'Key2']);
        });

        test('iterators work on empty map', () => {
            const map = new CaselessMap<string>();

            assert.deepStrictEqual(Array.from(map.keys()), []);
            assert.deepStrictEqual(Array.from(map.values()), []);
            assert.deepStrictEqual(Array.from(map.entries()), []);
            assert.deepStrictEqual(Array.from(map), []);
        });

        test('iterators reflect current state after modifications', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            map.set('key2', 'value2');

            let keys = Array.from(map.keys()).sort();
            assert.deepStrictEqual(keys, ['key1', 'key2']);

            map.delete('key1');
            keys = Array.from(map.keys());
            assert.deepStrictEqual(keys, ['key2']);

            map.set('key3', 'value3');
            keys = Array.from(map.keys()).sort();
            assert.deepStrictEqual(keys, ['key2', 'key3']);
        });
    });

    suite('forEach', () => {
        test('forEach iterates over all entries', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            map.set('key2', 'value2');
            map.set('key3', 'value3');

            const visited: Array<[string, string]> = [];
            map.forEach((value, key) => {
                visited.push([key, value]);
            });

            assert.strictEqual(visited.length, 3);
        });

        test('forEach keys preserve original case', () => {
            const map = new CaselessMap<string>();

            map.set('MixedCase', 'value1');
            map.set('ALLCAPS', 'value2');

            const keys: string[] = [];
            map.forEach((_, key) => {
                keys.push(key);
            });

            assert.deepStrictEqual(keys.sort(), ['ALLCAPS', 'MixedCase']);
        });

        test('forEach respects thisArg', () => {
            const map = new CaselessMap<string>();

            map.set('key', 'value');

            const thisArg = { called: false };
            map.forEach(function (this: typeof thisArg) {
                this.called = true;
            }, thisArg);

            assert.strictEqual(thisArg.called, true);
        });

        test('forEach receives correct parameters', () => {
            const map = new CaselessMap<number>();

            map.set('TestKey', 42);

            map.forEach((value, key, mapArg) => {
                assert.strictEqual(value, 42);
                assert.strictEqual(key, 'TestKey');
                assert.strictEqual(mapArg, map);
            });
        });

        test('forEach does nothing on empty map', () => {
            const map = new CaselessMap<string>();

            let called = false;
            map.forEach(() => {
                called = true;
            });

            assert.strictEqual(called, false);
        });
    });

    suite('clear', () => {
        test('clear removes all entries', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            map.set('key2', 'value2');
            map.set('key3', 'value3');

            assert.strictEqual(map.size, 3);

            map.clear();

            assert.strictEqual(map.size, 0);
            assert.strictEqual(map.has('key1'), false);
            assert.strictEqual(map.has('key2'), false);
            assert.strictEqual(map.has('key3'), false);
            assert.deepStrictEqual(Array.from(map.keys()), []);
        });

        test('clear on empty map does nothing', () => {
            const map = new CaselessMap<string>();

            map.clear();

            assert.strictEqual(map.size, 0);
        });

        test('map is usable after clear', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            map.clear();
            map.set('key2', 'value2');

            assert.strictEqual(map.size, 1);
            assert.strictEqual(map.get('key2'), 'value2');
            assert.strictEqual(map.has('key1'), false);
        });
    });

    suite('Symbol.toStringTag', () => {
        test('has correct toStringTag', () => {
            const map = new CaselessMap<string>();

            assert.strictEqual(map[Symbol.toStringTag], 'CaselessMap');
            assert.strictEqual(Object.prototype.toString.call(map), '[object CaselessMap]');
        });
    });

    suite('complex scenarios', () => {
        test('handles multiple value types', () => {
            const map = new CaselessMap<string | number | boolean | object | null | undefined>();

            map.set('string', 'text');
            map.set('number', 42);
            map.set('boolean', true);
            map.set('object', { nested: 'value' });
            map.set('null', null);
            map.set('undefined', undefined);

            assert.strictEqual(map.get('STRING'), 'text');
            assert.strictEqual(map.get('NUMBER'), 42);
            assert.strictEqual(map.get('BOOLEAN'), true);
            assert.deepStrictEqual(map.get('OBJECT'), { nested: 'value' });
            assert.strictEqual(map.get('NULL'), null);
            assert.strictEqual(map.get('UNDEFINED'), undefined);
        });

        test('stress test with many entries', () => {
            const map = new CaselessMap<number>();
            const count = 1000;

            // Add many entries
            for (let i = 0; i < count; i++) {
                map.set(`Key${i}`, i);
            }

            assert.strictEqual(map.size, count);

            // Verify random access with different cases
            assert.strictEqual(map.get('key500'), 500);
            assert.strictEqual(map.get('KEY750'), 750);
            assert.strictEqual(map.get('Key250'), 250);

            // Delete half
            for (let i = 0; i < count / 2; i++) {
                map.delete(`KEY${i}`);
            }

            assert.strictEqual(map.size, count / 2);
            assert.strictEqual(map.has('key0'), false);
            assert.strictEqual(map.has('key999'), true);
        });

        test('preserves value references', () => {
            const map = new CaselessMap<{ value: number }>();
            const obj = { value: 42 };

            map.set('Key', obj);

            const retrieved = map.get('key');
            assert.strictEqual(retrieved, obj, 'should be same reference');

            // Modify through reference
            if (retrieved) {
                retrieved.value = 100;
            }

            assert.strictEqual(map.get('KEY')?.value, 100);
        });

        test('independent instances do not interfere', () => {
            const map1 = new CaselessMap<string>();
            const map2 = new CaselessMap<string>();

            map1.set('key', 'value1');
            map2.set('key', 'value2');

            assert.strictEqual(map1.get('key'), 'value1');
            assert.strictEqual(map2.get('key'), 'value2');

            map1.delete('key');

            assert.strictEqual(map1.has('key'), false);
            assert.strictEqual(map2.has('key'), true);
        });
    });
});
