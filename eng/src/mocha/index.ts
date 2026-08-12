/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// NOTE: Unlike the rest of the repo, these files are loaded by Node directly rather than through a
// bundler, so relative imports must carry the '.js' extension that Node's ESM resolver requires.
// The resolve hook that makes extensionless imports work for consumers' tests cannot help here,
// because this graph is what registers it, and static imports are resolved before any of it runs.
import './register-hooks.js';
import './chai-setup.js';
