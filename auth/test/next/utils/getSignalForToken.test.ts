/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mock } from 'node:test';
import { expect } from 'chai';
import type * as vscode from 'vscode';
import { getSignalForToken } from '../../../src/next/utils/getSignalForToken';

/**
 * A minimal fake of {@link vscode.CancellationToken} whose `onCancellationRequested` listeners can be
 * fired manually. The listener registration and disposal are `node:test` mocks so calls can be inspected.
 */
function createFakeToken(isCancellationRequested: boolean) {
    const dispose = mock.fn();
    const onCancellationRequested = mock.fn((_listener: () => void) => ({ dispose }));
    const token = { isCancellationRequested, onCancellationRequested } as unknown as vscode.CancellationToken;

    return {
        token,
        fire: () => { for (const call of onCancellationRequested.mock.calls) { call.arguments[0](); } },
        disposeCount: () => dispose.mock.callCount(),
    };
}

describe('(unit) getSignalForToken()', () => {
    it('returns undefined when no token is provided', () => {
        expect(getSignalForToken(undefined)).to.equal(undefined);
    });

    it('returns an already-aborted signal when the token is already cancelled', () => {
        const { token } = createFakeToken(true);
        const signal = getSignalForToken(token);
        expect(signal).to.be.ok;
        expect(signal!.aborted).to.equal(true);
    });

    it('returns a non-aborted signal that aborts when the token is later cancelled', () => {
        const fake = createFakeToken(false);
        const signal = getSignalForToken(fake.token);
        expect(signal!.aborted).to.equal(false);

        fake.fire();

        expect(signal!.aborted).to.equal(true);
        // The cancellation listener should have disposed itself after firing.
        expect(fake.disposeCount()).to.equal(1);
    });
});
