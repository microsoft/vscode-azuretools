/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azExtEslintStrictTypeChecked } from './src/eslint/eslintConfigs.ts';
import tseslint from 'typescript-eslint';

export default [
    ...azExtEslintStrictTypeChecked,
    {
        ...tseslint.configs.disableTypeChecked,
        files: ['bin/*.mjs'],
    },
];
