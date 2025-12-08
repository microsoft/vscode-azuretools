/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { testGlobalSetup } from '../index';

// Runs before all tests
suiteSetup(async () => {
    testGlobalSetup();
});
