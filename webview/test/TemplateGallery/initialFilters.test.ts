/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createInitialFilters } from '../../src/webview/TemplateGallery/initialFilters';

suite('(unit) createInitialFilters', () => {
    test('defaults to showing all templates', () => {
        assert.deepStrictEqual(createInitialFilters(), {
            language: 'all',
            useCase: 'all',
            resource: 'all',
            search: '',
        });
    });

    test('merges configured filters with defaults', () => {
        assert.deepStrictEqual(createInitialFilters({ language: 'go', search: 'http' }), {
            language: 'go',
            useCase: 'all',
            resource: 'all',
            search: 'http',
        });
    });
});
