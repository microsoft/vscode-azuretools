/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { register } from 'node:module';

// Registers a lightweight resolve hook so that extensionless relative imports
// (e.g. './foo') resolve to '.ts' files when running under Node's built-in
// type-stripping mode instead of tsx.
register('./resolve-ts.mjs', import.meta.url);
