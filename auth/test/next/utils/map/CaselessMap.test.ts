/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { CaselessMap } from '../../../../src/next/utils/map/CaselessMap';

describe('(unit) CaselessMap', () => {
    describe('set get delete has', () => {
        it('set works case insensitively', () => {
            const map = new CaselessMap<string>();

            map.set('FooBar', 'value1');
            expect(map.get('foobar'), 'lowercase key should retrieve value').to.equal('value1');
            expect(map.get('FOOBAR'), 'uppercase key should retrieve value').to.equal('value1');
            expect(map.get('FooBar'), 'mixed case key should retrieve value').to.equal('value1');
            expect(map.get('fOObAR'), 'random case key should retrieve value').to.equal('value1');
        });

        it('set overwrites existing value with different case', () => {
            const map = new CaselessMap<number>();

            map.set('Key', 1);
            map.set('KEY', 2);
            map.set('key', 3);

            expect(map.size, 'should only have one entry').to.equal(1);
            expect(map.get('KEY'), 'should have latest value').to.equal(3);
            // The key returned should be the most recent one set
            expect(Array.from(map.keys())[0], 'should have latest key case').to.equal('key');
        });

        it('key case is updated on each overwrite', () => {
            const map = new CaselessMap<string>();

            map.set('OriginalCase', 'value1');
            expect(Array.from(map.keys())[0], 'should preserve original case').to.equal('OriginalCase');

            map.set('ORIGINALCASE', 'value2');
            expect(Array.from(map.keys())[0], 'should update to uppercase').to.equal('ORIGINALCASE');

            map.set('originalcase', 'value3');
            expect(Array.from(map.keys())[0], 'should update to lowercase').to.equal('originalcase');

            map.set('OrIgInAlCaSe', 'value4');
            expect(Array.from(map.keys())[0], 'should update to mixed case').to.equal('OrIgInAlCaSe');

            // Verify all return the same value
            expect(map.get('OriginalCase')).to.equal('value4');
            expect(map.get('ORIGINALCASE')).to.equal('value4');
            expect(map.get('originalcase')).to.equal('value4');
            expect(map.get('OrIgInAlCaSe')).to.equal('value4');

            // Verify size stayed at 1
            expect(map.size).to.equal(1);
        });

        it('get returns undefined for non-existent key', () => {
            const map = new CaselessMap<string>();

            expect(map.get('nonexistent')).to.equal(undefined);
            expect(map.get('')).to.equal(undefined);
        });

        it('has works case insensitively', () => {
            const map = new CaselessMap<string>();

            map.set('TestKey', 'value');

            expect(map.has('testkey')).to.equal(true);
            expect(map.has('TESTKEY')).to.equal(true);
            expect(map.has('TestKey')).to.equal(true);
            expect(map.has('tEsTkEy')).to.equal(true);
            expect(map.has('nonexistent')).to.equal(false);
        });

        it('delete works case insensitively', () => {
            const map = new CaselessMap<string>();

            map.set('DeleteMe', 'value');
            expect(map.has('DeleteMe')).to.equal(true);

            const deleted = map.delete('deleteme');
            expect(deleted, 'delete should return true').to.equal(true);
            expect(map.has('DeleteMe'), 'key should be gone').to.equal(false);
            expect(map.size, 'size should be 0').to.equal(0);
        });

        it('delete returns false for non-existent key', () => {
            const map = new CaselessMap<string>();

            const deleted = map.delete('nonexistent');
            expect(deleted).to.equal(false);
        });

        it('set returns this for chaining', () => {
            const map = new CaselessMap<string>();

            const result = map.set('key1', 'value1').set('key2', 'value2').set('key3', 'value3');

            expect(result, 'should return same instance').to.equal(map);
            expect(map.size).to.equal(3);
        });

        it('handles empty string as key', () => {
            const map = new CaselessMap<string>();

            map.set('', 'empty');
            expect(map.get('')).to.equal('empty');
            expect(map.has('')).to.equal(true);
            expect(map.delete('')).to.equal(true);
            expect(map.has('')).to.equal(false);
        });

        it('handles special characters in keys case insensitively', () => {
            const map = new CaselessMap<string>();

            map.set('Key-With_Special.Chars!', 'value');
            expect(map.get('key-with_special.chars!')).to.equal('value');
            expect(map.get('KEY-WITH_SPECIAL.CHARS!')).to.equal('value');
        });

        it('handles unicode characters case insensitively', () => {
            const map = new CaselessMap<string>();

            map.set('Café', 'value');
            expect(map.get('café')).to.equal('value');
            expect(map.get('CAFÉ')).to.equal('value');
        });
    });

    describe('size', () => {
        it('size is 0 for empty map', () => {
            const map = new CaselessMap<string>();
            expect(map.size).to.equal(0);
        });

        it('size increases with set', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            expect(map.size).to.equal(1);

            map.set('key2', 'value2');
            expect(map.size).to.equal(2);

            map.set('key3', 'value3');
            expect(map.size).to.equal(3);
        });

        it('size does not increase when overwriting', () => {
            const map = new CaselessMap<string>();

            map.set('Key', 'value1');
            expect(map.size).to.equal(1);

            map.set('key', 'value2');
            expect(map.size, 'size should still be 1').to.equal(1);

            map.set('KEY', 'value3');
            expect(map.size, 'size should still be 1').to.equal(1);
        });

        it('size decreases with delete', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            map.set('key2', 'value2');
            expect(map.size).to.equal(2);

            map.delete('key1');
            expect(map.size).to.equal(1);

            map.delete('KEY2');
            expect(map.size).to.equal(0);
        });
    });

    describe('iterators', () => {
        it('keys() preserve original case', () => {
            const map = new CaselessMap<string>();

            map.set('FooBar', 'value1');
            map.set('BazQux', 'value2');
            map.set('ALLCAPS', 'value3');

            const keys = Array.from(map.keys()).sort();
            expect(keys).to.deep.equal(['ALLCAPS', 'BazQux', 'FooBar']);
        });

        it('entries() keys preserve original case', () => {
            const map = new CaselessMap<string>();

            map.set('MixedCase', 'value1');
            map.set('UPPERCASE', 'value2');

            const entries = Array.from(map.entries());
            expect(entries.length).to.equal(2);
            const keys = entries.map(([key]) => key).sort();
            expect(keys).to.deep.equal(['MixedCase', 'UPPERCASE']);
        });

        it('values() returns all values', () => {
            const map = new CaselessMap<number>();

            map.set('key1', 1);
            map.set('key2', 2);
            map.set('key3', 3);

            const values = Array.from(map.values()).sort();
            expect(values).to.deep.equal([1, 2, 3]);
        });

        it('Symbol.iterator keys preserve original case', () => {
            const map = new CaselessMap<string>();

            map.set('Key1', 'value1');
            map.set('Key2', 'value2');

            const entries = Array.from(map);
            expect(entries.length).to.equal(2);
            const keys = entries.map(([key]) => key).sort();
            expect(keys).to.deep.equal(['Key1', 'Key2']);
        });

        it('iterators work on empty map', () => {
            const map = new CaselessMap<string>();

            expect(Array.from(map.keys())).to.deep.equal([]);
            expect(Array.from(map.values())).to.deep.equal([]);
            expect(Array.from(map.entries())).to.deep.equal([]);
            expect(Array.from(map)).to.deep.equal([]);
        });

        it('iterators reflect current state after modifications', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            map.set('key2', 'value2');

            let keys = Array.from(map.keys()).sort();
            expect(keys).to.deep.equal(['key1', 'key2']);

            map.delete('key1');
            keys = Array.from(map.keys());
            expect(keys).to.deep.equal(['key2']);

            map.set('key3', 'value3');
            keys = Array.from(map.keys()).sort();
            expect(keys).to.deep.equal(['key2', 'key3']);
        });
    });

    describe('forEach', () => {
        it('forEach iterates over all entries', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            map.set('key2', 'value2');
            map.set('key3', 'value3');

            const visited: Array<[string, string]> = [];
            map.forEach((value, key) => {
                visited.push([key, value]);
            });

            expect(visited.length).to.equal(3);
        });

        it('forEach keys preserve original case', () => {
            const map = new CaselessMap<string>();

            map.set('MixedCase', 'value1');
            map.set('ALLCAPS', 'value2');

            const keys: string[] = [];
            map.forEach((_, key) => {
                keys.push(key);
            });

            expect(keys.sort()).to.deep.equal(['ALLCAPS', 'MixedCase']);
        });

        it('forEach respects thisArg', () => {
            const map = new CaselessMap<string>();

            map.set('key', 'value');

            const thisArg = { called: false };
            map.forEach(function (this: typeof thisArg) {
                this.called = true;
            }, thisArg);

            expect(thisArg.called).to.equal(true);
        });

        it('forEach receives correct parameters', () => {
            const map = new CaselessMap<number>();

            map.set('TestKey', 42);

            map.forEach((value, key, mapArg) => {
                expect(value).to.equal(42);
                expect(key).to.equal('TestKey');
                expect(mapArg).to.equal(map);
            });
        });

        it('forEach does nothing on empty map', () => {
            const map = new CaselessMap<string>();

            let called = false;
            map.forEach(() => {
                called = true;
            });

            expect(called).to.equal(false);
        });
    });

    describe('clear', () => {
        it('clear removes all entries', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            map.set('key2', 'value2');
            map.set('key3', 'value3');

            expect(map.size).to.equal(3);

            map.clear();

            expect(map.size).to.equal(0);
            expect(map.has('key1')).to.equal(false);
            expect(map.has('key2')).to.equal(false);
            expect(map.has('key3')).to.equal(false);
            expect(Array.from(map.keys())).to.deep.equal([]);
        });

        it('clear on empty map does nothing', () => {
            const map = new CaselessMap<string>();

            map.clear();

            expect(map.size).to.equal(0);
        });

        it('map is usable after clear', () => {
            const map = new CaselessMap<string>();

            map.set('key1', 'value1');
            map.clear();
            map.set('key2', 'value2');

            expect(map.size).to.equal(1);
            expect(map.get('key2')).to.equal('value2');
            expect(map.has('key1')).to.equal(false);
        });
    });

    describe('Symbol.toStringTag', () => {
        it('has correct toStringTag', () => {
            const map = new CaselessMap<string>();

            expect(map[Symbol.toStringTag]).to.equal('CaselessMap');
            expect(Object.prototype.toString.call(map)).to.equal('[object CaselessMap]');
        });
    });

    describe('complex scenarios', () => {
        it('handles multiple value types', () => {
            const map = new CaselessMap<string | number | boolean | object | null | undefined>();

            map.set('string', 'text');
            map.set('number', 42);
            map.set('boolean', true);
            map.set('object', { nested: 'value' });
            map.set('null', null);
            map.set('undefined', undefined);

            expect(map.get('STRING')).to.equal('text');
            expect(map.get('NUMBER')).to.equal(42);
            expect(map.get('BOOLEAN')).to.equal(true);
            expect(map.get('OBJECT')).to.deep.equal({ nested: 'value' });
            expect(map.get('NULL')).to.equal(null);
            expect(map.get('UNDEFINED')).to.equal(undefined);
        });

        it('stress test with many entries', () => {
            const map = new CaselessMap<number>();
            const count = 1000;

            // Add many entries
            for (let i = 0; i < count; i++) {
                map.set(`Key${i}`, i);
            }

            expect(map.size).to.equal(count);

            // Verify random access with different cases
            expect(map.get('key500')).to.equal(500);
            expect(map.get('KEY750')).to.equal(750);
            expect(map.get('Key250')).to.equal(250);

            // Delete half
            for (let i = 0; i < count / 2; i++) {
                map.delete(`KEY${i}`);
            }

            expect(map.size).to.equal(count / 2);
            expect(map.has('key0')).to.equal(false);
            expect(map.has('key999')).to.equal(true);
        });

        it('preserves value references', () => {
            const map = new CaselessMap<{ value: number }>();
            const obj = { value: 42 };

            map.set('Key', obj);

            const retrieved = map.get('key');
            expect(retrieved, 'should be same reference').to.equal(obj);

            // Modify through reference
            retrieved!.value = 100;

            expect(map.get('KEY')?.value).to.equal(100);
        });

        it('independent instances do not interfere', () => {
            const map1 = new CaselessMap<string>();
            const map2 = new CaselessMap<string>();

            map1.set('key', 'value1');
            map2.set('key', 'value2');

            expect(map1.get('key')).to.equal('value1');
            expect(map2.get('key')).to.equal('value2');

            map1.delete('key');

            expect(map1.has('key')).to.equal(false);
            expect(map2.has('key')).to.equal(true);
        });
    });
});
