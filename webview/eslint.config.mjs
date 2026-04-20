/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { azExtEslintRecommended } from '@microsoft/vscode-azext-eng/eslint'; // Other configurations exist
import { defineConfig } from 'eslint/config';

export default defineConfig([
    {
        ignores: ['react-shim.js']
    },
    azExtEslintRecommended,
    {
        rules: {
            '@typescript-eslint/no-namespace': 'off',
            'no-useless-escape': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'default',
                    format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
                    leadingUnderscore: 'allow'
                },
                {
                    selector: 'objectLiteralProperty',
                    format: null,
                    filter: {
                        regex: '^__|\\s',
                        match: true,
                    },
                },
            ]
        }
    },
]);

