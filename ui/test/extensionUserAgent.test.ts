/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:no-any

import * as assert from 'assert';
import { window } from 'vscode';
import { appendExtensionUserAgent } from '../src/extensionUserAgent';

(<any>window).getPackageInfo = (): [string, string] => {
    return ['a', 'b'];
};

// tslint:disable-next-line:max-func-body-length
suite('Extension user agent', () => {
    suite('appendExtensionUserAgent', () => {
        const extensionUserAgent: string = 'hello';

        test('null/undefined/empty existing user agent', () => {
            assert.equal(appendExtensionUserAgent(<string><any>null), extensionUserAgent);
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
});
