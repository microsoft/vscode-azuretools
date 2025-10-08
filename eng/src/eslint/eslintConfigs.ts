/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ConfigObject as EslintConfig } from '@eslint/core';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Universal rules that should apply to all projects
 * @note This is exported but not meant to be used in isolation, but rather as a building block for other configs
 */
export const azExtUniversalRules: EslintConfig = {
    ignores: ['out/**', 'node_modules/**', 'dist/**', '**/*.d.ts', '.vscode-test*', 'eslint.config.mjs', 'webpack.config.mjs', 'esbuild.mjs'],
    languageOptions: {
        parserOptions: {
            projectService: true,
        },
    },
    rules: {
        /* eslint-disable @typescript-eslint/naming-convention */
        curly: 'warn',
        eqeqeq: 'warn',
        'no-extra-boolean-cast': 'off',
        'no-template-curly-in-string': 'warn',
        semi: 'warn',
        /* eslint-enable @typescript-eslint/naming-convention */
    },
};

/**
 * Stylistic rules that should apply to all projects
 * @note This is exported but not meant to be used in isolation, but rather as a building block for other configs
 */
export const azExtStylisticRules: EslintConfig = {
    rules: {
        /* eslint-disable @typescript-eslint/naming-convention */
        '@typescript-eslint/naming-convention': [
            // Naming is enforced with some exceptions below
            'warn',
            {
                // Names should be either camelCase or PascalCase, both are extensively used throughout our projects
                selector: 'default',
                format: ['camelCase', 'PascalCase'],
            },
            {
                // const variables can also have UPPER_CASE
                selector: 'variable',
                modifiers: ['const'],
                format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
            },
            {
                // private class properties can also have leading _underscores
                selector: 'classProperty',
                modifiers: ['private'],
                format: ['camelCase', 'PascalCase'],
                leadingUnderscore: 'allow',
            }
        ],
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-unused-vars': [
            'warn',
            {
                // As a function parameter, unused parameters are allowed
                args: 'none',
            }
        ],
        /* eslint-enable @typescript-eslint/naming-convention */
    },
};

/**
 * Recommended ESLint configuration for Azure extensions
 */
export const azExtEslintRecommended: EslintConfig[] = defineConfig(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    tseslint.configs.stylistic,
    azExtUniversalRules,
    azExtStylisticRules,
);

/**
 * Recommended ESLint configuration for Azure extensions with extra type-checked rules enabled
 */
export const azExtEslintRecommendedTypeChecked: EslintConfig[] = defineConfig(
    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    azExtUniversalRules,
    azExtStylisticRules,
);

/**
 * Strict ESLint configuration for Azure extensions
 */
export const azExtEslintStrict: EslintConfig[] = defineConfig(
    eslint.configs.recommended,
    tseslint.configs.strict,
    tseslint.configs.stylistic,
    azExtUniversalRules,
    azExtStylisticRules,
);

/**
 * Strict ESLint configuration for Azure extensions with extra type-checked rules enabled
 */
export const azExtEslintStrictTypeChecked: EslintConfig[] = defineConfig(
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    azExtUniversalRules,
    azExtStylisticRules,
);
