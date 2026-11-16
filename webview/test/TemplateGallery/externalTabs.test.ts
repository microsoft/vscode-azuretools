/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { findExternalTabById, findExternalTabForUseCase, getGalleryTabs, getValidExternalTabs } from '../../src/webview/TemplateGallery/externalTabs';

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

    test('places external tabs between Browse Templates and Copilot Chat', () => {
        assert.deepStrictEqual(getGalleryTabs([connectors], true).map(tab => tab.id), ['browse', 'connectors', 'ai']);
        assert.deepStrictEqual(getGalleryTabs([connectors], false).map(tab => tab.id), ['browse', 'connectors']);
        assert.deepStrictEqual(getGalleryTabs([], true).map(tab => tab.id), ['browse', 'ai']);
    });

    test('maps owned use cases case-insensitively and never owns "all"', () => {
        assert.strictEqual(findExternalTabForUseCase([connectors], 'connectors'), connectors);
        assert.strictEqual(findExternalTabForUseCase([connectors], 'all'), undefined);
        assert.strictEqual(findExternalTabForUseCase([connectors], 'http'), undefined);
        assert.strictEqual(findExternalTabForUseCase([{ id: 'x', label: 'X', useCases: ['all'] }], 'all'), undefined);
    });
});
