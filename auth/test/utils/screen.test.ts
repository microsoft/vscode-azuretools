/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type { AzureAccount } from '../../src/contracts/AzureAccount';
import type { AzureTenant } from '../../src/contracts/AzureTenant';
import { screen } from '../../src/utils/screen';

suite('(unit) screen()', () => {
    suite('accounts', () => {
        test('screens normal emails', () => {
            assert.strictEqual(screen({ id: '1', label: 'user@example.com' }), 'u***r@e***.com');
            assert.strictEqual(screen({ id: '2', label: 'user@example.net' }), 'u***r@e***.net');
            assert.strictEqual(screen({ id: '3', label: 'user@example.org' }), 'u***r@e***.org');
            assert.strictEqual(screen({ id: '4', label: 'user@example.co.uk' }), 'u***r@e***.co.uk');
            assert.strictEqual(screen({ id: '5', label: 'user@example.com.au' }), 'u***r@e***.com.au');
        });

        test('screens unknown tlds', () => {
            assert.strictEqual(screen({ id: '1', label: 'user@example.xyz' }), 'u***r@e***z');
        });

        test('screens short emails', () => {
            assert.strictEqual(screen({ id: '2', label: 'u@example.com' }), '***@e***.com');
            assert.strictEqual(screen({ id: '3', label: 'us@example.com' }), '***@e***.com');
        });

        test('screens short domains', () => {
            assert.strictEqual(screen({ id: '3', label: 'user@e.co.uk' }), 'u***r@***.co.uk');
            assert.strictEqual(screen({ id: '4', label: 'user@e.com.au' }), 'u***r@***.com.au');
            assert.strictEqual(screen({ id: '5', label: 'user@e.xyz' }), 'u***r@e***z');
        });

        test('screens invalid input or non-emails', () => {
            assert.strictEqual(screen({ id: '4', label: 'not-an-email' }), '4');
            assert.strictEqual(screen({ id: '5', label: 'a@b' }), '5');
            assert.strictEqual(screen({ id: '6', label: 'invalid@.com' }), '6');
            assert.strictEqual(screen({ id: '7', label: 'invalid@domain' }), '7');
            assert.strictEqual(screen({ id: '8', label: 'invalid@domain.' }), '8');
            assert.strictEqual(screen({ id: '9', label: 'invalid' }), '9');
        });
    });

    suite('tenants', () => {
        test('screens normal display names', () => {
            assert.strictEqual(screen({ tenantId: '1', displayName: 'Contoso' }), 'C***o');
            assert.strictEqual(screen({ tenantId: '2', displayName: 'My Tenant' }), 'M***t');
        });

        test('screens short display names', () => {
            assert.strictEqual(screen({ tenantId: '3', displayName: 'AB' }), '3');
            assert.strictEqual(screen({ tenantId: '4', displayName: 'A' }), '4');
        });
    });

    suite('invalid input', () => {
        test('returns "unknown" for missing label/displayName', () => {
            assert.strictEqual(screen({ id: '1' } as unknown as AzureAccount), 'unknown');
            assert.strictEqual(screen({ id: '2', label: '' } as unknown as AzureAccount), 'unknown');

            assert.strictEqual(screen({ tenantId: '3' } as unknown as AzureTenant), 'unknown');
            assert.strictEqual(screen({ tenantId: '4', displayName: '' } as unknown as AzureTenant), 'unknown');
        });
    });
});
