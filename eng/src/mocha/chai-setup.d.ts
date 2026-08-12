/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { expect as chaiExpect } from 'chai';

declare global {
    /**
     * Chai's `expect`, registered as a global by the shared mocha setup.
     */
    const expect: typeof chaiExpect;
}

export {};
