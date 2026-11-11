/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { findExternalTabById, findExternalTabForUseCase, getValidExternalTabs } from '../../src/webview/TemplateGallery/externalTabs';

suite('(unit) externalTabs', () => {
    const connectors = { id: 'connectors', label: 'Connectors', useCases: ['Connectors'] };

    test('drops tabs that collide with built-in or earlier ids', () => {
        const tabs = getValidExternalTabs([
            { id: 'browse', label: 'Browse' },
            { id: 'ai', label: 'AI' },
            { id: '', label: 'Empty' },
            connectors,
            { id: 'connectors', label: 'Duplicate' },
        ]);
        assert.deepStrictEqual(tabs, [connectors]);
    });

    test('defaults to no tabs', () => {
        assert.deepStrictEqual(getValidExternalTabs(undefined), []);
    });

    test('finds tabs by id', () => {
        assert.strictEqual(findExternalTabById([connectors], 'connectors'), connectors);
        assert.strictEqual(findExternalTabById([connectors], 'browse'), undefined);
    });

    test('maps owned use cases case-insensitively and never owns "all"', () => {
        assert.strictEqual(findExternalTabForUseCase([connectors], 'connectors'), connectors);
        assert.strictEqual(findExternalTabForUseCase([connectors], 'all'), undefined);
        assert.strictEqual(findExternalTabForUseCase([connectors], 'http'), undefined);
        assert.strictEqual(findExternalTabForUseCase([{ id: 'x', label: 'X', useCases: ['all'] }], 'all'), undefined);
    });
});
