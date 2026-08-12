/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { use, type expect as chaiExpect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

// Re-exported purely so that the generated declaration keeps a reference to 'chai-as-promised'.
// That module augments the global `Chai` namespace, so pulling it into the declaration is what
// makes assertions like `.rejectedWith()` visible to consumers off the back of a single entry in
// their tsconfig `types` array. A plain import would be elided from the declaration emit.
export type ChaiAsPromised = typeof chaiAsPromised;

// Registers the chai-as-promised plugin, making assertions like
// `await expect(promise).to.be.rejectedWith(/foo/)` available to consumers. The
// triple-slash reference above is emitted into the generated declaration, so the
// matching type augmentation comes along with it.
use(chaiAsPromised);

// Registers chai's `expect` as a global, so tests can use it without importing chai.
import 'chai/register-expect.js';

declare global {
    /**
     * Chai's `expect`, registered as a global by the shared mocha setup.
     */
    const expect: typeof chaiExpect;
}
