/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { appendExtensionUserAgent } from '../src/appendExtensionUserAgent';

suite('Extension user agent', () => {
    const extensionUserAgent: string = 'azureextensionui/0.0.1';

    test('null/undefined/empty existing user agent', () => {
        assert.equal(appendExtensionUserAgent(<string><unknown>null), extensionUserAgent);
        assert.equal(appendExtensionUserAgent(undefined), extensionUserAgent);
        assert.equal(appendExtensionUserAgent(''), extensionUserAgent);
    });

    test('non-empty existing user agent', () => {
        assert.equal(appendExtensionUserAgent('My User Agent'), `My User Agent ${extensionUserAgent}`);
    });

    test('already in existing user agent', () => {
        const userAgent: string = `My User ${extensionUserAgent} Agent`;
        assert.equal(appendExtensionUserAgent(userAgent), userAgent);
    });
});
