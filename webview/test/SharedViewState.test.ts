/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import {
    resetSharedState,
    SharedState,
    updateLoadingViewProgress,
} from '../src/extension/SharedViewState';

suite('(unit) SharedViewState', () => {
    teardown(() => {
        resetSharedState();
        SharedState.currentPanel = undefined;
    });

    test('resetSharedState resets mutable fields to defaults', () => {
        SharedState.itemsToClear = 7;
        SharedState.cancelled = false;
        SharedState.copilotClicked = true;
        SharedState.editingPicks = true;
        SharedState.loadingViewController = { addProgressItem: () => { /* no-op */ } };

        resetSharedState();

        assert.strictEqual(SharedState.itemsToClear, 0);
        assert.strictEqual(SharedState.cancelled, true);
        assert.strictEqual(SharedState.copilotClicked, false);
        assert.strictEqual(SharedState.editingPicks, false);
        assert.strictEqual(SharedState.loadingViewController, undefined);
    });

    test('updateLoadingViewProgress forwards to the registered controller', () => {
        const received: string[] = [];
        SharedState.loadingViewController = {
            addProgressItem: (name) => {
                received.push(name);
            },
        };

        updateLoadingViewProgress('step-1');
        updateLoadingViewProgress('step-2');

        assert.deepStrictEqual(received, ['step-1', 'step-2']);
    });

    test('updateLoadingViewProgress is a no-op when no controller is registered', () => {
        SharedState.loadingViewController = undefined;
        // Should not throw.
        updateLoadingViewProgress('orphan');
    });
});
