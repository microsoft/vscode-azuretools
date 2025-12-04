/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { TwoKeyCaselessMap } from '../../../src/utils/map/TwoKeyCaselessMap';

suite('(unit) TwoKeyCaselessMap', () => {
    suite('set get delete has', () => {
        test('set works case insensitively for both keys', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('FooBar', 'BazQux', 'value1');
            assert.strictEqual(map.get('foobar', 'bazqux'), 'value1', 'lowercase keys should retrieve value');
            assert.strictEqual(map.get('FOOBAR', 'BAZQUX'), 'value1', 'uppercase keys should retrieve value');
            assert.strictEqual(map.get('FooBar', 'BazQux'), 'value1', 'mixed case keys should retrieve value');
            assert.strictEqual(map.get('fOObAR', 'bAZqUX'), 'value1', 'random case keys should retrieve value');
        });

        test('set overwrites existing value with different case combinations', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('Key1', 'Key2', 1);
            map.set('KEY1', 'key2', 2);
            map.set('key1', 'KEY2', 3);

            assert.strictEqual(map.size, 1, 'should only have one entry');
            assert.strictEqual(map.get('key1', 'key2'), 3, 'should have latest value');
        });

        test('get returns undefined for non-existent key combinations', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            assert.strictEqual(map.get('nonexistent', 'key2'), undefined);
            assert.strictEqual(map.get('key1', 'nonexistent'), undefined);
            assert.strictEqual(map.get('nonexistent', 'nonexistent'), undefined);
        });

        test('has works case insensitively for both keys', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('TestKey1', 'TestKey2', 'value');

            assert.strictEqual(map.has('testkey1', 'testkey2'), true);
            assert.strictEqual(map.has('TESTKEY1', 'TESTKEY2'), true);
            assert.strictEqual(map.has('TestKey1', 'TestKey2'), true);
            assert.strictEqual(map.has('tEsTkEy1', 'tEsTkEy2'), true);
            assert.strictEqual(map.has('nonexistent', 'TestKey2'), false);
            assert.strictEqual(map.has('TestKey1', 'nonexistent'), false);
        });

        test('delete works case insensitively for both keys', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('DeleteMe1', 'DeleteMe2', 'value');
            assert.strictEqual(map.has('DeleteMe1', 'DeleteMe2'), true);

            const deleted = map.delete('deleteme1', 'DELETEME2');
            assert.strictEqual(deleted, true, 'delete should return true');
            assert.strictEqual(map.has('DeleteMe1', 'DeleteMe2'), false, 'keys should be gone');
            assert.strictEqual(map.size, 0, 'size should be 0');
        });

        test('delete returns false for non-existent key combinations', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            assert.strictEqual(map.delete('nonexistent', 'key2'), false);
            assert.strictEqual(map.delete('key1', 'nonexistent'), false);
            assert.strictEqual(map.size, 1, 'size should be unchanged');
        });

        test('set returns this for chaining', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            const result = map
                .set('key1', 'key2', 'value1')
                .set('key3', 'key4', 'value2')
                .set('key5', 'key6', 'value3');

            assert.strictEqual(result, map, 'should return same instance');
            assert.strictEqual(map.size, 3);
        });

        test('handles empty strings as keys', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('', '', 'value1');
            map.set('key', '', 'value2');
            map.set('', 'key', 'value3');

            assert.strictEqual(map.get('', ''), 'value1');
            assert.strictEqual(map.get('key', ''), 'value2');
            assert.strictEqual(map.get('', 'key'), 'value3');
            assert.strictEqual(map.size, 3);
        });

        test('handles special characters in keys case insensitively', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('Key-With_Special.Chars!', 'Another-Key@Hash', 'value');
            assert.strictEqual(map.get('key-with_special.chars!', 'another-key@hash'), 'value');
            assert.strictEqual(map.get('KEY-WITH_SPECIAL.CHARS!', 'ANOTHER-KEY@HASH'), 'value');
        });

        test('different first keys with same second key are distinct', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('key1', 'shared', 1);
            map.set('key2', 'shared', 2);
            map.set('key3', 'shared', 3);

            assert.strictEqual(map.size, 3);
            assert.strictEqual(map.get('key1', 'shared'), 1);
            assert.strictEqual(map.get('key2', 'shared'), 2);
            assert.strictEqual(map.get('key3', 'shared'), 3);
        });

        test('same first key with different second keys are distinct', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('shared', 'key1', 1);
            map.set('shared', 'key2', 2);
            map.set('shared', 'key3', 3);

            assert.strictEqual(map.size, 3);
            assert.strictEqual(map.get('shared', 'key1'), 1);
            assert.strictEqual(map.get('shared', 'key2'), 2);
            assert.strictEqual(map.get('shared', 'key3'), 3);
        });
    });

    suite('size', () => {
        test('size is 0 for empty map', () => {
            const map = new TwoKeyCaselessMap<string>(true);
            assert.strictEqual(map.size, 0);
        });

        test('size increases with set', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            assert.strictEqual(map.size, 1);

            map.set('key3', 'key4', 'value2');
            assert.strictEqual(map.size, 2);

            map.set('key5', 'key6', 'value3');
            assert.strictEqual(map.size, 3);
        });

        test('size does not increase when overwriting', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('Key1', 'Key2', 'value1');
            assert.strictEqual(map.size, 1);

            map.set('key1', 'key2', 'value2');
            assert.strictEqual(map.size, 1, 'size should still be 1');

            map.set('KEY1', 'KEY2', 'value3');
            assert.strictEqual(map.size, 1, 'size should still be 1');
        });

        test('size decreases with delete', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.set('key3', 'key4', 'value2');
            assert.strictEqual(map.size, 2);

            map.delete('key1', 'key2');
            assert.strictEqual(map.size, 1);

            map.delete('KEY3', 'KEY4');
            assert.strictEqual(map.size, 0);
        });
    });

    suite('clearByFirstKey', () => {
        test('clearByFirstKey removes all entries with matching first key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant1', 'sub2', 'value2');
            map.set('tenant1', 'sub3', 'value3');
            map.set('tenant2', 'sub1', 'value4');

            assert.strictEqual(map.size, 4);

            map.clearByFirstKey('tenant1');

            assert.strictEqual(map.size, 1);
            assert.strictEqual(map.has('tenant1', 'sub1'), false);
            assert.strictEqual(map.has('tenant1', 'sub2'), false);
            assert.strictEqual(map.has('tenant1', 'sub3'), false);
            assert.strictEqual(map.has('tenant2', 'sub1'), true);
        });

        test('clearByFirstKey works case insensitively', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('TenantKey', 'sub1', 'value1');
            map.set('TenantKey', 'sub2', 'value2');

            map.clearByFirstKey('tenantkey');

            assert.strictEqual(map.size, 0);
        });

        test('clearByFirstKey on non-existent key does nothing', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            map.clearByFirstKey('nonexistent');

            assert.strictEqual(map.size, 1);
            assert.strictEqual(map.has('key1', 'key2'), true);
        });

        test('clearByFirstKey maintains consistency in both internal maps', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant1', 'sub2', 'value2');
            map.set('tenant2', 'sub1', 'value3');

            map.clearByFirstKey('tenant1');

            // Should still be able to query by second key
            const entriesBySub1 = Array.from(map.entriesBySecondKey('sub1'));
            assert.strictEqual(entriesBySub1.length, 1);
            assert.strictEqual(entriesBySub1[0][0], 'tenant2');

            const entriesBySub2 = Array.from(map.entriesBySecondKey('sub2'));
            assert.strictEqual(entriesBySub2.length, 0);
        });
    });

    suite('clearBySecondKey', () => {
        test('clearBySecondKey removes all entries with matching second key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'shared', 'value1');
            map.set('tenant2', 'shared', 'value2');
            map.set('tenant3', 'shared', 'value3');
            map.set('tenant1', 'other', 'value4');

            assert.strictEqual(map.size, 4);

            map.clearBySecondKey('shared');

            assert.strictEqual(map.size, 1);
            assert.strictEqual(map.has('tenant1', 'shared'), false);
            assert.strictEqual(map.has('tenant2', 'shared'), false);
            assert.strictEqual(map.has('tenant3', 'shared'), false);
            assert.strictEqual(map.has('tenant1', 'other'), true);
        });

        test('clearBySecondKey works case insensitively', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'SubKey', 'value1');
            map.set('tenant2', 'SubKey', 'value2');

            map.clearBySecondKey('subkey');

            assert.strictEqual(map.size, 0);
        });

        test('clearBySecondKey on non-existent key does nothing', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            map.clearBySecondKey('nonexistent');

            assert.strictEqual(map.size, 1);
            assert.strictEqual(map.has('key1', 'key2'), true);
        });

        test('clearBySecondKey maintains consistency in both internal maps', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant2', 'sub1', 'value2');
            map.set('tenant1', 'sub2', 'value3');

            map.clearBySecondKey('sub1');

            // Should still be able to query by first key
            const entriesByTenant1 = Array.from(map.entriesByFirstKey('tenant1'));
            assert.strictEqual(entriesByTenant1.length, 1);
            assert.strictEqual(entriesByTenant1[0][0], 'sub2');

            const entriesByTenant2 = Array.from(map.entriesByFirstKey('tenant2'));
            assert.strictEqual(entriesByTenant2.length, 0);
        });
    });

    suite('clear', () => {
        test('clear removes all entries', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.set('key3', 'key4', 'value2');
            map.set('key5', 'key6', 'value3');

            assert.strictEqual(map.size, 3);

            map.clear();

            assert.strictEqual(map.size, 0);
            assert.strictEqual(map.has('key1', 'key2'), false);
            assert.strictEqual(map.has('key3', 'key4'), false);
            assert.strictEqual(map.has('key5', 'key6'), false);
            assert.deepStrictEqual(Array.from(map.keys()), []);
        });

        test('clear on empty map does nothing', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.clear();

            assert.strictEqual(map.size, 0);
        });

        test('map is usable after clear', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.clear();
            map.set('key3', 'key4', 'value2');

            assert.strictEqual(map.size, 1);
            assert.strictEqual(map.get('key3', 'key4'), 'value2');
            assert.strictEqual(map.has('key1', 'key2'), false);
        });
    });

    suite('iterators by first key', () => {
        test('entriesByFirstKey returns entries with matching first key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant1', 'sub2', 'value2');
            map.set('tenant2', 'sub3', 'value3');

            const entries = Array.from(map.entriesByFirstKey('tenant1')).sort((a, b) => a[0].localeCompare(b[0]));

            assert.strictEqual(entries.length, 2);
            assert.deepStrictEqual(entries[0], ['sub1', 'value1']);
            assert.deepStrictEqual(entries[1], ['sub2', 'value2']);
        });

        test('entriesByFirstKey works case insensitively', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('TenantKey', 'sub1', 'value1');
            map.set('TenantKey', 'sub2', 'value2');

            const entries = Array.from(map.entriesByFirstKey('tenantkey'));
            assert.strictEqual(entries.length, 2);
        });

        test('entriesByFirstKey keys preserve original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'MixedCase', 'value');

            const entries = Array.from(map.entriesByFirstKey('key1'));
            assert.strictEqual(entries[0][0], 'MixedCase');
        });

        test('entriesByFirstKey returns empty iterator for non-existent key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            const entries = Array.from(map.entriesByFirstKey('nonexistent'));
            assert.deepStrictEqual(entries, []);
        });

        test('keysByFirstKey returns keys with matching first key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant1', 'sub2', 'value2');
            map.set('tenant2', 'sub3', 'value3');

            const keys = Array.from(map.keysByFirstKey('tenant1')).sort();

            assert.deepStrictEqual(keys, ['sub1', 'sub2']);
        });

        test('keysByFirstKey keys preserve original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'MixedCase', 'value');

            const keys = Array.from(map.keysByFirstKey('key1'));
            assert.strictEqual(keys[0], 'MixedCase');
        });

        test('valuesByFirstKey returns values with matching first key', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('tenant1', 'sub1', 1);
            map.set('tenant1', 'sub2', 2);
            map.set('tenant2', 'sub3', 3);

            const values = Array.from(map.valuesByFirstKey('tenant1')).sort();

            assert.deepStrictEqual(values, [1, 2]);
        });
    });

    suite('iterators by second key', () => {
        test('entriesBySecondKey returns entries with matching second key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant2', 'sub1', 'value2');
            map.set('tenant3', 'sub2', 'value3');

            const entries = Array.from(map.entriesBySecondKey('sub1')).sort((a, b) => a[0].localeCompare(b[0]));

            assert.strictEqual(entries.length, 2);
            assert.deepStrictEqual(entries[0], ['tenant1', 'value1']);
            assert.deepStrictEqual(entries[1], ['tenant2', 'value2']);
        });

        test('entriesBySecondKey works case insensitively', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'SubKey', 'value1');
            map.set('tenant2', 'SubKey', 'value2');

            const entries = Array.from(map.entriesBySecondKey('subkey'));
            assert.strictEqual(entries.length, 2);
        });

        test('entriesBySecondKey keys preserve original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('MixedCase', 'sub1', 'value');

            const entries = Array.from(map.entriesBySecondKey('sub1'));
            assert.strictEqual(entries[0][0], 'MixedCase');
        });

        test('entriesBySecondKey returns empty iterator for non-existent key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            const entries = Array.from(map.entriesBySecondKey('nonexistent'));
            assert.deepStrictEqual(entries, []);
        });

        test('keysBySecondKey returns keys with matching second key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant2', 'sub1', 'value2');
            map.set('tenant3', 'sub2', 'value3');

            const keys = Array.from(map.keysBySecondKey('sub1')).sort();

            assert.deepStrictEqual(keys, ['tenant1', 'tenant2']);
        });

        test('keysBySecondKey keys preserve original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('MixedCase', 'sub1', 'value');

            const keys = Array.from(map.keysBySecondKey('sub1'));
            assert.strictEqual(keys[0], 'MixedCase');
        });

        test('valuesBySecondKey returns values with matching second key', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('tenant1', 'sub1', 1);
            map.set('tenant2', 'sub1', 2);
            map.set('tenant3', 'sub2', 3);

            const values = Array.from(map.valuesBySecondKey('sub1')).sort();

            assert.deepStrictEqual(values, [1, 2]);
        });
    });

    suite('global iterators', () => {
        test('keys() returns all key pairs in original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('Tenant1', 'Sub1', 'value1');
            map.set('Tenant2', 'Sub2', 'value2');

            const keys = Array.from(map.keys()).sort((a, b) => a[0].localeCompare(b[0]));

            assert.strictEqual(keys.length, 2);
            assert.deepStrictEqual(keys[0], ['Tenant1', 'Sub1']);
            assert.deepStrictEqual(keys[1], ['Tenant2', 'Sub2']);
        });

        test('values() returns all values', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('key1', 'key2', 1);
            map.set('key3', 'key4', 2);
            map.set('key5', 'key6', 3);

            const values = Array.from(map.values()).sort();
            assert.deepStrictEqual(values, [1, 2, 3]);
        });

        test('entries() returns all entries with original case keys', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('Key1', 'Key2', 'value1');
            map.set('Key3', 'Key4', 'value2');

            const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));

            assert.strictEqual(entries.length, 2);
            assert.strictEqual(entries[0][0], 'Key1');
            assert.strictEqual(entries[0][1], 'Key2');
            assert.strictEqual(entries[0][2], 'value1');
            assert.strictEqual(entries[1][0], 'Key3');
            assert.strictEqual(entries[1][1], 'Key4');
            assert.strictEqual(entries[1][2], 'value2');
        });

        test('Symbol.iterator returns all entries', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.set('key3', 'key4', 'value2');

            const entries = Array.from(map);
            assert.strictEqual(entries.length, 2);
        });

        test('iterators work on empty map', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            assert.deepStrictEqual(Array.from(map.keys()), []);
            assert.deepStrictEqual(Array.from(map.values()), []);
            assert.deepStrictEqual(Array.from(map.entries()), []);
            assert.deepStrictEqual(Array.from(map), []);
        });

        test('iterators reflect current state after modifications', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.set('key3', 'key4', 'value2');

            let keys = Array.from(map.keys()).sort((a, b) => a[0].localeCompare(b[0]));
            assert.strictEqual(keys.length, 2);

            map.delete('key1', 'key2');
            keys = Array.from(map.keys());
            assert.strictEqual(keys.length, 1);

            map.set('key5', 'key6', 'value3');
            keys = Array.from(map.keys());
            assert.strictEqual(keys.length, 2);
        });
    });

    suite('forEach', () => {
        test('forEach iterates over all entries', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.set('key3', 'key4', 'value2');
            map.set('key5', 'key6', 'value3');

            const visited: Array<[string, string, string]> = [];
            map.forEach((value, key1, key2) => {
                visited.push([key1, key2, value]);
            });

            assert.strictEqual(visited.length, 3);
        });

        test('forEach keys preserve original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('MixedCase1', 'MixedCase2', 'value1');
            map.set('ALLCAPS1', 'ALLCAPS2', 'value2');

            const keys: Array<[string, string]> = [];
            map.forEach((_, key1, key2) => {
                keys.push([key1, key2]);
            });

            const sortedKeys = keys.sort((a, b) => a[0].localeCompare(b[0]));
            assert.deepStrictEqual(sortedKeys[0], ['ALLCAPS1', 'ALLCAPS2']);
            assert.deepStrictEqual(sortedKeys[1], ['MixedCase1', 'MixedCase2']);
        });

        test('forEach respects thisArg', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            const thisArg = { called: false };
            map.forEach(function (this: typeof thisArg) {
                this.called = true;
            }, thisArg);

            assert.strictEqual(thisArg.called, true);
        });

        test('forEach receives correct parameters', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('TestKey1', 'TestKey2', 42);

            let callbackCalled = false;
            map.forEach((value, key1, key2) => {
                assert.strictEqual(value, 42);
                assert.strictEqual(key1, 'TestKey1');
                assert.strictEqual(key2, 'TestKey2');
                callbackCalled = true;
            });

            assert.strictEqual(callbackCalled, true);
        });

        test('forEach does nothing on empty map', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            let called = false;
            map.forEach(() => {
                called = true;
            });

            assert.strictEqual(called, false);
        });
    });

    suite('Symbol.toStringTag', () => {
        test('has correct toStringTag', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            assert.strictEqual(map[Symbol.toStringTag], 'TwoKeyCaselessMap');
            assert.strictEqual(Object.prototype.toString.call(map), '[object TwoKeyCaselessMap]');
        });
    });

    suite('complex scenarios', () => {
        test('handles multiple value types', () => {
            const map = new TwoKeyCaselessMap<string | number | boolean | object | null | undefined>(true);

            map.set('key1', 'string', 'text');
            map.set('key2', 'number', 42);
            map.set('key3', 'boolean', true);
            map.set('key4', 'object', { nested: 'value' });
            map.set('key5', 'null', null);
            map.set('key6', 'undefined', undefined);

            assert.strictEqual(map.get('KEY1', 'STRING'), 'text');
            assert.strictEqual(map.get('KEY2', 'NUMBER'), 42);
            assert.strictEqual(map.get('KEY3', 'BOOLEAN'), true);
            assert.deepStrictEqual(map.get('KEY4', 'OBJECT'), { nested: 'value' });
            assert.strictEqual(map.get('KEY5', 'NULL'), null);
            assert.strictEqual(map.get('KEY6', 'UNDEFINED'), undefined);
        });

        test('stress test with many entries', () => {
            const map = new TwoKeyCaselessMap<number>(true);
            const count = 100; // 100x100 = 10,000 entries

            // Add many entries
            for (let i = 0; i < count; i++) {
                for (let j = 0; j < count; j++) {
                    map.set(`Tenant${i}`, `Sub${j}`, i * count + j);
                }
            }

            assert.strictEqual(map.size, count * count);

            // Verify random access with different cases
            assert.strictEqual(map.get('tenant50', 'sub50'), 50 * count + 50);
            assert.strictEqual(map.get('TENANT75', 'SUB25'), 75 * count + 25);

            // Delete by first key
            map.clearByFirstKey('TENANT0');
            assert.strictEqual(map.size, (count - 1) * count);
            assert.strictEqual(map.has('tenant0', 'sub0'), false);

            // Delete by second key
            map.clearBySecondKey('sub0');
            assert.strictEqual(map.size, (count - 1) * (count - 1));
        });

        test('preserves value references', () => {
            const map = new TwoKeyCaselessMap<{ value: number }>(true);
            const obj = { value: 42 };

            map.set('Key1', 'Key2', obj);

            const retrieved = map.get('key1', 'key2');
            assert.strictEqual(retrieved, obj, 'should be same reference');

            // Modify through reference
            if (retrieved) {
                retrieved.value = 100;
            }

            assert.strictEqual(map.get('KEY1', 'KEY2')?.value, 100);
        });

        test('independent instances do not interfere', () => {
            const map1 = new TwoKeyCaselessMap<string>(true);
            const map2 = new TwoKeyCaselessMap<string>(true);

            map1.set('key1', 'key2', 'value1');
            map2.set('key1', 'key2', 'value2');

            assert.strictEqual(map1.get('key1', 'key2'), 'value1');
            assert.strictEqual(map2.get('key1', 'key2'), 'value2');

            map1.delete('key1', 'key2');

            assert.strictEqual(map1.has('key1', 'key2'), false);
            assert.strictEqual(map2.has('key1', 'key2'), true);
        });

        test('complex clearing scenarios', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            // Create a grid pattern
            map.set('tenant1', 'sub1', 'v1-1');
            map.set('tenant1', 'sub2', 'v1-2');
            map.set('tenant1', 'sub3', 'v1-3');
            map.set('tenant2', 'sub1', 'v2-1');
            map.set('tenant2', 'sub2', 'v2-2');
            map.set('tenant3', 'sub1', 'v3-1');

            assert.strictEqual(map.size, 6);

            // Clear by first key
            map.clearByFirstKey('tenant1');
            assert.strictEqual(map.size, 3);

            // Clear by second key
            map.clearBySecondKey('sub1');
            assert.strictEqual(map.size, 1);

            // Only tenant2-sub2 should remain
            assert.strictEqual(map.has('tenant2', 'sub2'), true);
            assert.strictEqual(map.get('tenant2', 'sub2'), 'v2-2');
        });

        test('bidirectional lookup consistency', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant1', 'sub2', 'value2');
            map.set('tenant2', 'sub1', 'value3');
            map.set('tenant2', 'sub3', 'value4');

            // Verify by first key
            const tenant1Keys = Array.from(map.keysByFirstKey('tenant1')).sort();
            assert.deepStrictEqual(tenant1Keys, ['sub1', 'sub2']);

            // Verify by second key
            const sub1Keys = Array.from(map.keysBySecondKey('sub1')).sort();
            assert.deepStrictEqual(sub1Keys, ['tenant1', 'tenant2']);

            // Delete and verify consistency
            map.delete('tenant1', 'sub1');

            const tenant1KeysAfter = Array.from(map.keysByFirstKey('tenant1'));
            assert.deepStrictEqual(tenant1KeysAfter, ['sub2']);

            const sub1KeysAfter = Array.from(map.keysBySecondKey('sub1'));
            assert.deepStrictEqual(sub1KeysAfter, ['tenant2']);
        });

        test('handles rapid modifications', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            // Rapid set/delete operations
            for (let i = 0; i < 50; i++) {
                map.set('key1', `sub${i}`, i);
                map.set('key2', `sub${i}`, i * 2);
            }

            assert.strictEqual(map.size, 100);

            for (let i = 0; i < 25; i++) {
                map.delete('key1', `sub${i}`);
            }

            assert.strictEqual(map.size, 75);

            map.clearByFirstKey('key2');

            assert.strictEqual(map.size, 25);

            // Verify remaining entries
            for (let i = 25; i < 50; i++) {
                assert.strictEqual(map.get('key1', `sub${i}`), i);
            }
        });

        test('empty iterator operations are safe', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            // All these should return empty iterators without errors
            assert.deepStrictEqual(Array.from(map.entriesByFirstKey('nonexistent')), []);
            assert.deepStrictEqual(Array.from(map.entriesBySecondKey('nonexistent')), []);
            assert.deepStrictEqual(Array.from(map.keysByFirstKey('nonexistent')), []);
            assert.deepStrictEqual(Array.from(map.keysBySecondKey('nonexistent')), []);
            assert.deepStrictEqual(Array.from(map.valuesByFirstKey('nonexistent')), []);
            assert.deepStrictEqual(Array.from(map.valuesBySecondKey('nonexistent')), []);
        });

        test('handles same key for both key1 and key2', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            // Set with identical keys
            map.set('SameKey', 'SameKey', 'value1');
            assert.strictEqual(map.size, 1);
            assert.strictEqual(map.get('samekey', 'samekey'), 'value1');
            assert.strictEqual(map.get('SAMEKEY', 'SAMEKEY'), 'value1');

            // Overwrite with different case
            map.set('samekey', 'SAMEKEY', 'value2');
            assert.strictEqual(map.size, 1, 'should still be one entry');
            assert.strictEqual(map.get('SameKey', 'SameKey'), 'value2');

            // Query by first and second key should both work
            const entriesByFirst = Array.from(map.entriesByFirstKey('SameKey'));
            const entriesBySecond = Array.from(map.entriesBySecondKey('SameKey'));
            assert.strictEqual(entriesByFirst.length, 1);
            assert.strictEqual(entriesBySecond.length, 1);
            assert.strictEqual(entriesByFirst[0][1], 'value2');
            assert.strictEqual(entriesBySecond[0][1], 'value2');

            // Delete should work
            map.delete('SAMEKEY', 'samekey');
            assert.strictEqual(map.size, 0);
            assert.strictEqual(map.has('SameKey', 'SameKey'), false);

            // Test with multiple entries where some have matching keys
            map.set('Key1', 'Key1', 'value1');
            map.set('Key1', 'Key2', 'value2');
            map.set('Key2', 'Key1', 'value3');
            map.set('Key2', 'Key2', 'value4');

            assert.strictEqual(map.size, 4);
            assert.strictEqual(map.get('key1', 'key1'), 'value1');
            assert.strictEqual(map.get('key2', 'key2'), 'value4');

            // Clear by first key should remove matching entries
            map.clearByFirstKey('Key1');
            assert.strictEqual(map.size, 2);
            assert.strictEqual(map.has('Key1', 'Key1'), false);
            assert.strictEqual(map.has('Key2', 'Key2'), true);

            // Clear by second key should work too
            map.clearBySecondKey('Key2');
            assert.strictEqual(map.size, 1);
            assert.strictEqual(map.has('Key2', 'Key1'), true);
        });
    });
});

