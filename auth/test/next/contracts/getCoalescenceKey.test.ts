/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import type * as vscode from 'vscode';
import { getCoalescenceKey } from '../../../src/next/contracts/AzureSubscriptionProviderRequestOptions';

describe('(unit) getCoalescenceKey()', () => {
    it('returns undefined when a cancellation token is present (never coalesce)', () => {
        const token = { isCancellationRequested: false } as unknown as vscode.CancellationToken;
        expect(getCoalescenceKey({ token })).to.equal(undefined);
    });

    it('builds a stable, sorted key from the provided options (ignoring the token field)', () => {
        const key = getCoalescenceKey({ filter: true, noCache: false });
        // Only keys present on the options object are included, sorted alphabetically.
        expect(key).to.equal('filter:true,noCache:false');
    });

    it('produces the same key regardless of property insertion order', () => {
        const a = getCoalescenceKey({ noCache: true, filter: false });
        const b = getCoalescenceKey({ filter: false, noCache: true });
        expect(a).to.equal(b);
    });

    it('substitutes the default value for a present-but-undefined option', () => {
        // `filter` is present but undefined, so its default (true) is used; `token` is always excluded.
        const key = getCoalescenceKey({ filter: undefined });
        expect(key).to.equal('filter:true');
    });

    it('returns an empty key when no options are provided', () => {
        expect(getCoalescenceKey({})).to.equal('');
    });
});
