/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { TwoKeyCaselessMap } from '../../../../src/next/utils/map/TwoKeyCaselessMap';

describe('(unit) TwoKeyCaselessMap', () => {
    describe('set get delete has', () => {
        it('set works case insensitively for both keys', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('FooBar', 'BazQux', 'value1');
            expect(map.get('foobar', 'bazqux'), 'lowercase keys should retrieve value').to.equal('value1');
            expect(map.get('FOOBAR', 'BAZQUX'), 'uppercase keys should retrieve value').to.equal('value1');
            expect(map.get('FooBar', 'BazQux'), 'mixed case keys should retrieve value').to.equal('value1');
            expect(map.get('fOObAR', 'bAZqUX'), 'random case keys should retrieve value').to.equal('value1');
        });

        it('set overwrites existing value with different case combinations', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('Key1', 'Key2', 1);
            map.set('KEY1', 'key2', 2);
            map.set('key1', 'KEY2', 3);

            expect(map.size, 'should only have one entry').to.equal(1);
            expect(map.get('key1', 'key2'), 'should have latest value').to.equal(3);
        });

        it('get returns undefined for non-existent key combinations', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            expect(map.get('nonexistent', 'key2')).to.equal(undefined);
            expect(map.get('key1', 'nonexistent')).to.equal(undefined);
            expect(map.get('nonexistent', 'nonexistent')).to.equal(undefined);
        });

        it('has works case insensitively for both keys', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('TestKey1', 'TestKey2', 'value');

            expect(map.has('testkey1', 'testkey2')).to.equal(true);
            expect(map.has('TESTKEY1', 'TESTKEY2')).to.equal(true);
            expect(map.has('TestKey1', 'TestKey2')).to.equal(true);
            expect(map.has('tEsTkEy1', 'tEsTkEy2')).to.equal(true);
            expect(map.has('nonexistent', 'TestKey2')).to.equal(false);
            expect(map.has('TestKey1', 'nonexistent')).to.equal(false);
        });

        it('delete works case insensitively for both keys', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('DeleteMe1', 'DeleteMe2', 'value');
            expect(map.has('DeleteMe1', 'DeleteMe2')).to.equal(true);

            const deleted = map.delete('deleteme1', 'DELETEME2');
            expect(deleted, 'delete should return true').to.equal(true);
            expect(map.has('DeleteMe1', 'DeleteMe2'), 'keys should be gone').to.equal(false);
            expect(map.size, 'size should be 0').to.equal(0);
        });

        it('delete returns false for non-existent key combinations', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            expect(map.delete('nonexistent', 'key2')).to.equal(false);
            expect(map.delete('key1', 'nonexistent')).to.equal(false);
            expect(map.size, 'size should be unchanged').to.equal(1);
        });

        it('set returns this for chaining', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            const result = map
                .set('key1', 'key2', 'value1')
                .set('key3', 'key4', 'value2')
                .set('key5', 'key6', 'value3');

            expect(result, 'should return same instance').to.equal(map);
            expect(map.size).to.equal(3);
        });

        it('handles empty strings as keys', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('', '', 'value1');
            map.set('key', '', 'value2');
            map.set('', 'key', 'value3');

            expect(map.get('', '')).to.equal('value1');
            expect(map.get('key', '')).to.equal('value2');
            expect(map.get('', 'key')).to.equal('value3');
            expect(map.size).to.equal(3);
        });

        it('handles special characters in keys case insensitively', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('Key-With_Special.Chars!', 'Another-Key@Hash', 'value');
            expect(map.get('key-with_special.chars!', 'another-key@hash')).to.equal('value');
            expect(map.get('KEY-WITH_SPECIAL.CHARS!', 'ANOTHER-KEY@HASH')).to.equal('value');
        });

        it('different first keys with same second key are distinct', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('key1', 'shared', 1);
            map.set('key2', 'shared', 2);
            map.set('key3', 'shared', 3);

            expect(map.size).to.equal(3);
            expect(map.get('key1', 'shared')).to.equal(1);
            expect(map.get('key2', 'shared')).to.equal(2);
            expect(map.get('key3', 'shared')).to.equal(3);
        });

        it('same first key with different second keys are distinct', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('shared', 'key1', 1);
            map.set('shared', 'key2', 2);
            map.set('shared', 'key3', 3);

            expect(map.size).to.equal(3);
            expect(map.get('shared', 'key1')).to.equal(1);
            expect(map.get('shared', 'key2')).to.equal(2);
            expect(map.get('shared', 'key3')).to.equal(3);
        });
    });

    describe('size', () => {
        it('size is 0 for empty map', () => {
            const map = new TwoKeyCaselessMap<string>(true);
            expect(map.size).to.equal(0);
        });

        it('size increases with set', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            expect(map.size).to.equal(1);

            map.set('key3', 'key4', 'value2');
            expect(map.size).to.equal(2);

            map.set('key5', 'key6', 'value3');
            expect(map.size).to.equal(3);
        });

        it('size does not increase when overwriting', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('Key1', 'Key2', 'value1');
            expect(map.size).to.equal(1);

            map.set('key1', 'key2', 'value2');
            expect(map.size, 'size should still be 1').to.equal(1);

            map.set('KEY1', 'KEY2', 'value3');
            expect(map.size, 'size should still be 1').to.equal(1);
        });

        it('size decreases with delete', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.set('key3', 'key4', 'value2');
            expect(map.size).to.equal(2);

            map.delete('key1', 'key2');
            expect(map.size).to.equal(1);

            map.delete('KEY3', 'KEY4');
            expect(map.size).to.equal(0);
        });
    });

    describe('clearByFirstKey', () => {
        it('clearByFirstKey removes all entries with matching first key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant1', 'sub2', 'value2');
            map.set('tenant1', 'sub3', 'value3');
            map.set('tenant2', 'sub1', 'value4');

            expect(map.size).to.equal(4);

            map.clearByFirstKey('tenant1');

            expect(map.size).to.equal(1);
            expect(map.has('tenant1', 'sub1')).to.equal(false);
            expect(map.has('tenant1', 'sub2')).to.equal(false);
            expect(map.has('tenant1', 'sub3')).to.equal(false);
            expect(map.has('tenant2', 'sub1')).to.equal(true);
        });

        it('clearByFirstKey works case insensitively', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('TenantKey', 'sub1', 'value1');
            map.set('TenantKey', 'sub2', 'value2');

            map.clearByFirstKey('tenantkey');

            expect(map.size).to.equal(0);
        });

        it('clearByFirstKey on non-existent key does nothing', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            map.clearByFirstKey('nonexistent');

            expect(map.size).to.equal(1);
            expect(map.has('key1', 'key2')).to.equal(true);
        });

        it('clearByFirstKey maintains consistency in both internal maps', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant1', 'sub2', 'value2');
            map.set('tenant2', 'sub1', 'value3');

            map.clearByFirstKey('tenant1');

            // Should still be able to query by second key
            const entriesBySub1 = Array.from(map.entriesBySecondKey('sub1'));
            expect(entriesBySub1.length).to.equal(1);
            expect(entriesBySub1[0][0]).to.equal('tenant2');

            const entriesBySub2 = Array.from(map.entriesBySecondKey('sub2'));
            expect(entriesBySub2.length).to.equal(0);
        });
    });

    describe('clearBySecondKey', () => {
        it('clearBySecondKey removes all entries with matching second key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'shared', 'value1');
            map.set('tenant2', 'shared', 'value2');
            map.set('tenant3', 'shared', 'value3');
            map.set('tenant1', 'other', 'value4');

            expect(map.size).to.equal(4);

            map.clearBySecondKey('shared');

            expect(map.size).to.equal(1);
            expect(map.has('tenant1', 'shared')).to.equal(false);
            expect(map.has('tenant2', 'shared')).to.equal(false);
            expect(map.has('tenant3', 'shared')).to.equal(false);
            expect(map.has('tenant1', 'other')).to.equal(true);
        });

        it('clearBySecondKey works case insensitively', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'SubKey', 'value1');
            map.set('tenant2', 'SubKey', 'value2');

            map.clearBySecondKey('subkey');

            expect(map.size).to.equal(0);
        });

        it('clearBySecondKey on non-existent key does nothing', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            map.clearBySecondKey('nonexistent');

            expect(map.size).to.equal(1);
            expect(map.has('key1', 'key2')).to.equal(true);
        });

        it('clearBySecondKey maintains consistency in both internal maps', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant2', 'sub1', 'value2');
            map.set('tenant1', 'sub2', 'value3');

            map.clearBySecondKey('sub1');

            // Should still be able to query by first key
            const entriesByTenant1 = Array.from(map.entriesByFirstKey('tenant1'));
            expect(entriesByTenant1.length).to.equal(1);
            expect(entriesByTenant1[0][0]).to.equal('sub2');

            const entriesByTenant2 = Array.from(map.entriesByFirstKey('tenant2'));
            expect(entriesByTenant2.length).to.equal(0);
        });
    });

    describe('clear', () => {
        it('clear removes all entries', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.set('key3', 'key4', 'value2');
            map.set('key5', 'key6', 'value3');

            expect(map.size).to.equal(3);

            map.clear();

            expect(map.size).to.equal(0);
            expect(map.has('key1', 'key2')).to.equal(false);
            expect(map.has('key3', 'key4')).to.equal(false);
            expect(map.has('key5', 'key6')).to.equal(false);
            expect(Array.from(map.keys())).to.deep.equal([]);
        });

        it('clear on empty map does nothing', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.clear();

            expect(map.size).to.equal(0);
        });

        it('map is usable after clear', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.clear();
            map.set('key3', 'key4', 'value2');

            expect(map.size).to.equal(1);
            expect(map.get('key3', 'key4')).to.equal('value2');
            expect(map.has('key1', 'key2')).to.equal(false);
        });
    });

    describe('iterators by first key', () => {
        it('entriesByFirstKey returns entries with matching first key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant1', 'sub2', 'value2');
            map.set('tenant2', 'sub3', 'value3');

            const entries = Array.from(map.entriesByFirstKey('tenant1')).sort((a, b) => a[0].localeCompare(b[0]));

            expect(entries.length).to.equal(2);
            expect(entries[0]).to.deep.equal(['sub1', 'value1']);
            expect(entries[1]).to.deep.equal(['sub2', 'value2']);
        });

        it('entriesByFirstKey works case insensitively', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('TenantKey', 'sub1', 'value1');
            map.set('TenantKey', 'sub2', 'value2');

            const entries = Array.from(map.entriesByFirstKey('tenantkey'));
            expect(entries.length).to.equal(2);
        });

        it('entriesByFirstKey keys preserve original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'MixedCase', 'value');

            const entries = Array.from(map.entriesByFirstKey('key1'));
            expect(entries[0][0]).to.equal('MixedCase');
        });

        it('entriesByFirstKey returns empty iterator for non-existent key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            const entries = Array.from(map.entriesByFirstKey('nonexistent'));
            expect(entries).to.deep.equal([]);
        });

        it('keysByFirstKey returns keys with matching first key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant1', 'sub2', 'value2');
            map.set('tenant2', 'sub3', 'value3');

            const keys = Array.from(map.keysByFirstKey('tenant1')).sort();

            expect(keys).to.deep.equal(['sub1', 'sub2']);
        });

        it('keysByFirstKey keys preserve original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'MixedCase', 'value');

            const keys = Array.from(map.keysByFirstKey('key1'));
            expect(keys[0]).to.equal('MixedCase');
        });

        it('valuesByFirstKey returns values with matching first key', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('tenant1', 'sub1', 1);
            map.set('tenant1', 'sub2', 2);
            map.set('tenant2', 'sub3', 3);

            const values = Array.from(map.valuesByFirstKey('tenant1')).sort();

            expect(values).to.deep.equal([1, 2]);
        });
    });

    describe('iterators by second key', () => {
        it('entriesBySecondKey returns entries with matching second key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant2', 'sub1', 'value2');
            map.set('tenant3', 'sub2', 'value3');

            const entries = Array.from(map.entriesBySecondKey('sub1')).sort((a, b) => a[0].localeCompare(b[0]));

            expect(entries.length).to.equal(2);
            expect(entries[0]).to.deep.equal(['tenant1', 'value1']);
            expect(entries[1]).to.deep.equal(['tenant2', 'value2']);
        });

        it('entriesBySecondKey works case insensitively', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'SubKey', 'value1');
            map.set('tenant2', 'SubKey', 'value2');

            const entries = Array.from(map.entriesBySecondKey('subkey'));
            expect(entries.length).to.equal(2);
        });

        it('entriesBySecondKey keys preserve original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('MixedCase', 'sub1', 'value');

            const entries = Array.from(map.entriesBySecondKey('sub1'));
            expect(entries[0][0]).to.equal('MixedCase');
        });

        it('entriesBySecondKey returns empty iterator for non-existent key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            const entries = Array.from(map.entriesBySecondKey('nonexistent'));
            expect(entries).to.deep.equal([]);
        });

        it('keysBySecondKey returns keys with matching second key', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant2', 'sub1', 'value2');
            map.set('tenant3', 'sub2', 'value3');

            const keys = Array.from(map.keysBySecondKey('sub1')).sort();

            expect(keys).to.deep.equal(['tenant1', 'tenant2']);
        });

        it('keysBySecondKey keys preserve original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('MixedCase', 'sub1', 'value');

            const keys = Array.from(map.keysBySecondKey('sub1'));
            expect(keys[0]).to.equal('MixedCase');
        });

        it('valuesBySecondKey returns values with matching second key', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('tenant1', 'sub1', 1);
            map.set('tenant2', 'sub1', 2);
            map.set('tenant3', 'sub2', 3);

            const values = Array.from(map.valuesBySecondKey('sub1')).sort();

            expect(values).to.deep.equal([1, 2]);
        });
    });

    describe('global iterators', () => {
        it('keys() returns all key pairs in original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('Tenant1', 'Sub1', 'value1');
            map.set('Tenant2', 'Sub2', 'value2');

            const keys = Array.from(map.keys()).sort((a, b) => a[0].localeCompare(b[0]));

            expect(keys.length).to.equal(2);
            expect(keys[0]).to.deep.equal(['Tenant1', 'Sub1']);
            expect(keys[1]).to.deep.equal(['Tenant2', 'Sub2']);
        });

        it('values() returns all values', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('key1', 'key2', 1);
            map.set('key3', 'key4', 2);
            map.set('key5', 'key6', 3);

            const values = Array.from(map.values()).sort();
            expect(values).to.deep.equal([1, 2, 3]);
        });

        it('entries() returns all entries with original case keys', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('Key1', 'Key2', 'value1');
            map.set('Key3', 'Key4', 'value2');

            const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));

            expect(entries.length).to.equal(2);
            expect(entries[0][0]).to.equal('Key1');
            expect(entries[0][1]).to.equal('Key2');
            expect(entries[0][2]).to.equal('value1');
            expect(entries[1][0]).to.equal('Key3');
            expect(entries[1][1]).to.equal('Key4');
            expect(entries[1][2]).to.equal('value2');
        });

        it('Symbol.iterator returns all entries', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.set('key3', 'key4', 'value2');

            const entries = Array.from(map);
            expect(entries.length).to.equal(2);
        });

        it('iterators work on empty map', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            expect(Array.from(map.keys())).to.deep.equal([]);
            expect(Array.from(map.values())).to.deep.equal([]);
            expect(Array.from(map.entries())).to.deep.equal([]);
            expect(Array.from(map)).to.deep.equal([]);
        });

        it('iterators reflect current state after modifications', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.set('key3', 'key4', 'value2');

            let keys = Array.from(map.keys()).sort((a, b) => a[0].localeCompare(b[0]));
            expect(keys.length).to.equal(2);

            map.delete('key1', 'key2');
            keys = Array.from(map.keys());
            expect(keys.length).to.equal(1);

            map.set('key5', 'key6', 'value3');
            keys = Array.from(map.keys());
            expect(keys.length).to.equal(2);
        });
    });

    describe('forEach', () => {
        it('forEach iterates over all entries', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value1');
            map.set('key3', 'key4', 'value2');
            map.set('key5', 'key6', 'value3');

            const visited: Array<[string, string, string]> = [];
            map.forEach((value, key1, key2) => {
                visited.push([key1, key2, value]);
            });

            expect(visited.length).to.equal(3);
        });

        it('forEach keys preserve original case', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('MixedCase1', 'MixedCase2', 'value1');
            map.set('ALLCAPS1', 'ALLCAPS2', 'value2');

            const keys: Array<[string, string]> = [];
            map.forEach((_, key1, key2) => {
                keys.push([key1, key2]);
            });

            const sortedKeys = keys.sort((a, b) => a[0].localeCompare(b[0]));
            expect(sortedKeys[0]).to.deep.equal(['ALLCAPS1', 'ALLCAPS2']);
            expect(sortedKeys[1]).to.deep.equal(['MixedCase1', 'MixedCase2']);
        });

        it('forEach respects thisArg', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('key1', 'key2', 'value');

            const thisArg = { called: false };
            map.forEach(function (this: typeof thisArg) {
                this.called = true;
            }, thisArg);

            expect(thisArg.called).to.equal(true);
        });

        it('forEach receives correct parameters', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            map.set('TestKey1', 'TestKey2', 42);

            let callbackCalled = false;
            map.forEach((value, key1, key2) => {
                expect(value).to.equal(42);
                expect(key1).to.equal('TestKey1');
                expect(key2).to.equal('TestKey2');
                callbackCalled = true;
            });

            expect(callbackCalled).to.equal(true);
        });

        it('forEach does nothing on empty map', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            let called = false;
            map.forEach(() => {
                called = true;
            });

            expect(called).to.equal(false);
        });
    });

    describe('Symbol.toStringTag', () => {
        it('has correct toStringTag', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            expect(map[Symbol.toStringTag]).to.equal('TwoKeyCaselessMap');
            expect(Object.prototype.toString.call(map)).to.equal('[object TwoKeyCaselessMap]');
        });
    });

    describe('complex scenarios', () => {
        it('handles multiple value types', () => {
            const map = new TwoKeyCaselessMap<string | number | boolean | object | null | undefined>(true);

            map.set('key1', 'string', 'text');
            map.set('key2', 'number', 42);
            map.set('key3', 'boolean', true);
            map.set('key4', 'object', { nested: 'value' });
            map.set('key5', 'null', null);
            map.set('key6', 'undefined', undefined);

            expect(map.get('KEY1', 'STRING')).to.equal('text');
            expect(map.get('KEY2', 'NUMBER')).to.equal(42);
            expect(map.get('KEY3', 'BOOLEAN')).to.equal(true);
            expect(map.get('KEY4', 'OBJECT')).to.deep.equal({ nested: 'value' });
            expect(map.get('KEY5', 'NULL')).to.equal(null);
            expect(map.get('KEY6', 'UNDEFINED')).to.equal(undefined);
        });

        it('stress test with many entries', () => {
            const map = new TwoKeyCaselessMap<number>(true);
            const count = 100; // 100x100 = 10,000 entries

            // Add many entries
            for (let i = 0; i < count; i++) {
                for (let j = 0; j < count; j++) {
                    map.set(`Tenant${i}`, `Sub${j}`, i * count + j);
                }
            }

            expect(map.size).to.equal(count * count);

            // Verify random access with different cases
            expect(map.get('tenant50', 'sub50')).to.equal(50 * count + 50);
            expect(map.get('TENANT75', 'SUB25')).to.equal(75 * count + 25);

            // Delete by first key
            map.clearByFirstKey('TENANT0');
            expect(map.size).to.equal((count - 1) * count);
            expect(map.has('tenant0', 'sub0')).to.equal(false);

            // Delete by second key
            map.clearBySecondKey('sub0');
            expect(map.size).to.equal((count - 1) * (count - 1));
        });

        it('preserves value references', () => {
            const map = new TwoKeyCaselessMap<{ value: number }>(true);
            const obj = { value: 42 };

            map.set('Key1', 'Key2', obj);

            const retrieved = map.get('key1', 'key2');
            expect(retrieved, 'should be same reference').to.equal(obj);

            // Modify through reference
            retrieved!.value = 100;

            expect(map.get('KEY1', 'KEY2')?.value).to.equal(100);
        });

        it('independent instances do not interfere', () => {
            const map1 = new TwoKeyCaselessMap<string>(true);
            const map2 = new TwoKeyCaselessMap<string>(true);

            map1.set('key1', 'key2', 'value1');
            map2.set('key1', 'key2', 'value2');

            expect(map1.get('key1', 'key2')).to.equal('value1');
            expect(map2.get('key1', 'key2')).to.equal('value2');

            map1.delete('key1', 'key2');

            expect(map1.has('key1', 'key2')).to.equal(false);
            expect(map2.has('key1', 'key2')).to.equal(true);
        });

        it('complex clearing scenarios', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            // Create a grid pattern
            map.set('tenant1', 'sub1', 'v1-1');
            map.set('tenant1', 'sub2', 'v1-2');
            map.set('tenant1', 'sub3', 'v1-3');
            map.set('tenant2', 'sub1', 'v2-1');
            map.set('tenant2', 'sub2', 'v2-2');
            map.set('tenant3', 'sub1', 'v3-1');

            expect(map.size).to.equal(6);

            // Clear by first key
            map.clearByFirstKey('tenant1');
            expect(map.size).to.equal(3);

            // Clear by second key
            map.clearBySecondKey('sub1');
            expect(map.size).to.equal(1);

            // Only tenant2-sub2 should remain
            expect(map.has('tenant2', 'sub2')).to.equal(true);
            expect(map.get('tenant2', 'sub2')).to.equal('v2-2');
        });

        it('bidirectional lookup consistency', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            map.set('tenant1', 'sub1', 'value1');
            map.set('tenant1', 'sub2', 'value2');
            map.set('tenant2', 'sub1', 'value3');
            map.set('tenant2', 'sub3', 'value4');

            // Verify by first key
            const tenant1Keys = Array.from(map.keysByFirstKey('tenant1')).sort();
            expect(tenant1Keys).to.deep.equal(['sub1', 'sub2']);

            // Verify by second key
            const sub1Keys = Array.from(map.keysBySecondKey('sub1')).sort();
            expect(sub1Keys).to.deep.equal(['tenant1', 'tenant2']);

            // Delete and verify consistency
            map.delete('tenant1', 'sub1');

            const tenant1KeysAfter = Array.from(map.keysByFirstKey('tenant1'));
            expect(tenant1KeysAfter).to.deep.equal(['sub2']);

            const sub1KeysAfter = Array.from(map.keysBySecondKey('sub1'));
            expect(sub1KeysAfter).to.deep.equal(['tenant2']);
        });

        it('handles rapid modifications', () => {
            const map = new TwoKeyCaselessMap<number>(true);

            // Rapid set/delete operations
            for (let i = 0; i < 50; i++) {
                map.set('key1', `sub${i}`, i);
                map.set('key2', `sub${i}`, i * 2);
            }

            expect(map.size).to.equal(100);

            for (let i = 0; i < 25; i++) {
                map.delete('key1', `sub${i}`);
            }

            expect(map.size).to.equal(75);

            map.clearByFirstKey('key2');

            expect(map.size).to.equal(25);

            // Verify remaining entries
            for (let i = 25; i < 50; i++) {
                expect(map.get('key1', `sub${i}`)).to.equal(i);
            }
        });

        it('empty iterator operations are safe', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            // All these should return empty iterators without errors
            expect(Array.from(map.entriesByFirstKey('nonexistent'))).to.deep.equal([]);
            expect(Array.from(map.entriesBySecondKey('nonexistent'))).to.deep.equal([]);
            expect(Array.from(map.keysByFirstKey('nonexistent'))).to.deep.equal([]);
            expect(Array.from(map.keysBySecondKey('nonexistent'))).to.deep.equal([]);
            expect(Array.from(map.valuesByFirstKey('nonexistent'))).to.deep.equal([]);
            expect(Array.from(map.valuesBySecondKey('nonexistent'))).to.deep.equal([]);
        });

        it('handles same key for both key1 and key2', () => {
            const map = new TwoKeyCaselessMap<string>(true);

            // Set with identical keys
            map.set('SameKey', 'SameKey', 'value1');
            expect(map.size).to.equal(1);
            expect(map.get('samekey', 'samekey')).to.equal('value1');
            expect(map.get('SAMEKEY', 'SAMEKEY')).to.equal('value1');

            // Overwrite with different case
            map.set('samekey', 'SAMEKEY', 'value2');
            expect(map.size, 'should still be one entry').to.equal(1);
            expect(map.get('SameKey', 'SameKey')).to.equal('value2');

            // Query by first and second key should both work
            const entriesByFirst = Array.from(map.entriesByFirstKey('SameKey'));
            const entriesBySecond = Array.from(map.entriesBySecondKey('SameKey'));
            expect(entriesByFirst.length).to.equal(1);
            expect(entriesBySecond.length).to.equal(1);
            expect(entriesByFirst[0][1]).to.equal('value2');
            expect(entriesBySecond[0][1]).to.equal('value2');

            // Delete should work
            map.delete('SAMEKEY', 'samekey');
            expect(map.size).to.equal(0);
            expect(map.has('SameKey', 'SameKey')).to.equal(false);

            // Test with multiple entries where some have matching keys
            map.set('Key1', 'Key1', 'value1');
            map.set('Key1', 'Key2', 'value2');
            map.set('Key2', 'Key1', 'value3');
            map.set('Key2', 'Key2', 'value4');

            expect(map.size).to.equal(4);
            expect(map.get('key1', 'key1')).to.equal('value1');
            expect(map.get('key2', 'key2')).to.equal('value4');

            // Clear by first key should remove matching entries
            map.clearByFirstKey('Key1');
            expect(map.size).to.equal(2);
            expect(map.has('Key1', 'Key1')).to.equal(false);
            expect(map.has('Key2', 'Key2')).to.equal(true);

            // Clear by second key should work too
            map.clearBySecondKey('Key2');
            expect(map.size).to.equal(1);
            expect(map.has('Key2', 'Key1')).to.equal(true);
        });
    });
});

