/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ConfigObject as EslintConfig } from '@eslint/core';
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Universal rules that should apply to all projects
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const azExtUniversalRules: EslintConfig = {
    languageOptions: {
        parserOptions: {
            projectService: true,
        },
    },
    rules: {
        curly: 'warn',
        eqeqeq: 'warn',
        'no-extra-boolean-cast': 'off', // Unnecessarily restrictive
        'no-template-curly-in-string': 'warn',
        semi: 'warn',
    },
};

/**
 * Stylistic rules that should apply to all projects
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const azExtStylisticRules: EslintConfig = {
    rules: {
        '@typescript-eslint/array-type': 'off', // Unnecessarily restrictive
        '@typescript-eslint/class-literal-property-style': 'off', // Unnecessarily restrictive
        '@typescript-eslint/consistent-indexed-object-style': 'off', // Unnecessarily restrictive
        '@typescript-eslint/consistent-generic-constructors': 'warn', // Move from error to warn
        '@typescript-eslint/consistent-type-assertions': 'off', // Unnecessarily restrictive
        '@typescript-eslint/consistent-type-definitions': 'off', // Unnecessarily restrictive
        '@typescript-eslint/naming-convention': [
            // Naming convention is enforced, with some exceptions below
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
            },
        ],
        '@typescript-eslint/no-inferrable-types': 'off', // Unnecessarily restrictive
        '@typescript-eslint/no-unused-vars': [
            // No unused variables, with some exceptions below
            'warn',
            {
                // As a function parameter, unused parameters are allowed
                args: 'none',
            },
        ],
    },
};

/**
 * A config that enforces lazy imports for @azure/* packages to reduce extension activation time
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const lazyImportAzurePackages = lazyImportRuleConfig(['@azure/*']);

/**
 * Gets a config that enforces lazy imports for certain packages to reduce extension activation time
 * @param patterns The patterns for packages that should be lazily imported
 * @returns The {@link EslintConfig}
 */
export function lazyImportRuleConfig(patterns: string[]): EslintConfig {
    return {
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: patterns,
                            message: 'Please lazily import this package within the function that uses it to reduce extension activation time.',
                            allowTypeImports: true,
                        },
                    ],
                },
            ],
        },
    };
}

/* eslint-enable @typescript-eslint/naming-convention */

const globalIgnoresList = ['out/**', 'node_modules/**', 'dist/**', '**/*.d.ts', '.vscode-test*', 'eslint.config.mjs', 'webpack.config.mjs', 'esbuild.mjs', 'main.*js'];

/**
 * Recommended ESLint configuration for Azure extensions
 */
export const azExtEslintRecommended: EslintConfig[] = defineConfig(
    globalIgnores(globalIgnoresList),
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
    globalIgnores(globalIgnoresList),
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
    globalIgnores(globalIgnoresList),
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
    globalIgnores(globalIgnoresList),
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    azExtUniversalRules,
    azExtStylisticRules,
);
