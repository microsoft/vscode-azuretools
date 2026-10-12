/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// NOTE: Unlike the rest of the repo, these files are loaded by Node directly rather than through a
// bundler. They are '.mts' so that they build to unambiguously-ESM '.mjs' output regardless of the
// package's "type", and relative imports must carry the extension that Node's ESM resolver
// requires. The resolve hook that makes extensionless imports work for consumers' tests cannot help
// here, because this graph is what registers it, and static imports resolve before any of it runs.
import './register-hooks.mjs';
import './test-globals.mjs';
