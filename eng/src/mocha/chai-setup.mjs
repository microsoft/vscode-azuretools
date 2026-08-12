/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

// Registers chai's `expect` as a global, so tests can use it without importing
// chai. Consumers must also add '@microsoft/vscode-azext-eng/mocha/chai-setup'
// to the `types` array in their tsconfig.json, to pick up the global type
// declaration.
import 'chai/register-expect.js';

// Registers the chai-as-promised plugin, making assertions like
// `await expect(promise).to.be.rejectedWith(/foo/)` available to consumers.
// Consumers must also add 'chai-as-promised' to the `types` array in their
// tsconfig.json, to pick up the global type augmentation.
use(chaiAsPromised);
