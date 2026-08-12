/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { globalIgnores } from 'eslint/config';
import { azExtEslintStrictTypeChecked } from './src/eslint/eslintConfigs.ts';

export default [
    ...azExtEslintStrictTypeChecked,
    // Build scripts are plain Node scripts, outside of the TypeScript project
    globalIgnores(['scripts/**']),
];
