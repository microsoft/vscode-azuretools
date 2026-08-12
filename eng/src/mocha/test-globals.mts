/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// These modules contribute global declarations rather than exports: '@types/mocha' declares
// `describe`, `it`, `suite`, `test`, etc., and 'chai-as-promised' augments the global `Chai`
// namespace with assertions like `.rejectedWith()` and `.eventually`. Referencing them here means
// a single entry in a consumer's tsconfig `types` array covers all of it, and they do not need
// '@types/mocha' of their own. 'preserve="true"' (TypeScript 5.5+) is required: a plain reference
// directive is treated as unused and silently dropped from the declaration emit.
/// <reference types="mocha" preserve="true" />
/// <reference types="chai-as-promised" preserve="true" />

import { use, type expect as chaiExpect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

// Registers the chai-as-promised plugin, making assertions like
// `await expect(promise).to.be.rejectedWith(/foo/)` available to consumers.
use(chaiAsPromised);

// Registers chai's `expect` as a global, so tests can use it without importing chai.
import 'chai/register-expect.js';

declare global {
    /**
     * Chai's `expect`, registered as a global by the shared test globals setup.
     */
    const expect: typeof chaiExpect;
}
