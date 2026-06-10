/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import type { AzureAccount } from '../../../src/contracts/AzureAccount';
import { screen } from '../../../src/next/utils/screen';

describe('(unit) screen()', () => {
    describe('accounts', () => {
        it('screens normal emails', () => {
            expect(screen({ id: '1', label: 'user@example.com' })).to.equal('u***r@e***.com');
            expect(screen({ id: '2', label: 'user@example.net' })).to.equal('u***r@e***.net');
            expect(screen({ id: '3', label: 'user@example.org' })).to.equal('u***r@e***.org');
            expect(screen({ id: '4', label: 'user@example.co.uk' })).to.equal('u***r@e***.co.uk');
            expect(screen({ id: '5', label: 'user@example.com.au' })).to.equal('u***r@e***.com.au');
        });

        it('screens unknown tlds', () => {
            expect(screen({ id: '1', label: 'user@example.xyz' })).to.equal('u***r@e***z');
        });

        it('screens short emails', () => {
            expect(screen({ id: '2', label: 'u@example.com' })).to.equal('***@e***.com');
            expect(screen({ id: '3', label: 'us@example.com' })).to.equal('***@e***.com');
        });

        it('screens short domains', () => {
            expect(screen({ id: '3', label: 'user@e.co.uk' })).to.equal('u***r@***.co.uk');
            expect(screen({ id: '4', label: 'user@e.com.au' })).to.equal('u***r@***.com.au');
            expect(screen({ id: '5', label: 'user@e.xyz' })).to.equal('u***r@e***z');
        });

        it('screens invalid input or non-emails', () => {
            expect(screen({ id: '4', label: 'not-an-email' })).to.equal('4');
            expect(screen({ id: '5', label: 'a@b' })).to.equal('5');
            expect(screen({ id: '6', label: 'invalid@.com' })).to.equal('6');
            expect(screen({ id: '7', label: 'invalid@domain' })).to.equal('7');
            expect(screen({ id: '8', label: 'invalid@domain.' })).to.equal('8');
            expect(screen({ id: '9', label: 'invalid' })).to.equal('9');
        });
    });

    describe('tenants', () => {
        it('screens normal display names', () => {
            expect(screen({ tenantId: '1', displayName: 'Contoso' })).to.equal('C***o');
            expect(screen({ tenantId: '2', displayName: 'My Tenant' })).to.equal('M***t');
        });

        it('screens short display names', () => {
            expect(screen({ tenantId: '3', displayName: 'AB' })).to.equal('3');
            expect(screen({ tenantId: '4', displayName: 'A' })).to.equal('4');
        });
    });

    describe('invalid input', () => {
        it('returns "unknown" for missing label/displayName', () => {
            expect(screen({ id: '1' } as unknown as AzureAccount)).to.equal('unknown');
            expect(screen({ id: '2', label: '' })).to.equal('unknown');

            expect(screen({ tenantId: '3' })).to.equal('unknown');
            expect(screen({ tenantId: '4', displayName: '' })).to.equal('unknown');
        });
    });
});
