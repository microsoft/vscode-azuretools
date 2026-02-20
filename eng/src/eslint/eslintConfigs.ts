/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ConfigObject as EslintConfig, Plugin as EslintPlugin } from '@eslint/core';
import eslint from '@eslint/js';
import eslintPluginHeader from '@tony.ganchev/eslint-plugin-header';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

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
        '@typescript-eslint/no-floating-promises': 'error', // Raise to error--we want to ensure promises are thoughtfully handled everywhere
        '@typescript-eslint/no-non-null-assertion': 'warn', // Raise to warning
        curly: 'warn', // Raise to warning
        eqeqeq: 'error', // Raise to error
        'no-template-curly-in-string': 'warn', // Raise to warning
        semi: 'warn', // Raise to warning

        // All of these are unnecessarily restrictive for our projects, so we shut them off
        '@typescript-eslint/array-type': 'off',
        '@typescript-eslint/class-literal-property-style': 'off',
        '@typescript-eslint/consistent-indexed-object-style': 'off',
        '@typescript-eslint/consistent-type-assertions': 'off',
        '@typescript-eslint/consistent-type-definitions': 'off',
        '@typescript-eslint/no-inferrable-types': 'off',
        'no-extra-boolean-cast': 'off',
    },
};

/**
 * Copyright header rule that should apply to all projects
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const azExtCopyrightHeaderRule: EslintConfig = {
    plugins: {
        'header': eslintPluginHeader as EslintPlugin,
    },
    rules: {
        'header/header': [
            'error',
            {
                header: {
                    commentType: 'block',
                    lines: [
                        {
                            pattern: /.*/,
                            template: '---------------------------------------------------------------------------------------------',
                        },
                        {
                            pattern: /Copyright.*Microsoft/,
                            template: ' *  Copyright (c) Microsoft Corporation. All rights reserved.',
                        },
                        {
                            pattern: /LICENSE/i,
                            template: ' *  Licensed under the MIT License. See LICENSE in the project root for license information.',
                        },
                        {
                            pattern: /.*/,
                            template: ' *--------------------------------------------------------------------------------------------',
                        },
                    ],
                },
                trailingEmptyLines: {
                    minimum: 2,
                },
            },
        ],
    },
};

/**
 * Rules that apply only to test code
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const azExtTestRules: EslintConfig = {
    files: ['**/*.test.ts'],
    rules: {
        '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in test files
        '@typescript-eslint/no-non-null-assertion': 'off', // Allow non-null assertions in test files
        '@typescript-eslint/no-unsafe-argument': 'off', // Allow unsafe arguments in test files (goes with any)
        '@typescript-eslint/no-unsafe-assignment': 'off', // Allow unsafe assignments in test files (goes with any)
        '@typescript-eslint/no-unsafe-member-access': 'off', // Allow unsafe member access in test files (goes with any)
        '@typescript-eslint/no-unused-expressions': 'off', // Allow unused expressions in test files (e.g., for chai 'expect' statements)
    },
};

/**
 * Stylistic rules that should apply to all projects
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const azExtStylisticRules: EslintConfig = {
    rules: {
        '@typescript-eslint/consistent-generic-constructors': 'warn', // Move from error to warn
        '@typescript-eslint/naming-convention': [
            // Naming convention is enforced, with some exceptions below
            'warn', // Move from error to warn
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
                // Function parameters should be camelCase, but can have a leading underscore if unused
                selector: 'parameter',
                format: ['camelCase'],
                leadingUnderscore: 'allow',
            },
            {
                // Object literal properties that require quotes are exempt
                selector: 'objectLiteralProperty',
                format: null,
                modifiers: ['requiresQuotes'],
            },
            {
                // private class properties can also have leading _underscores
                selector: 'memberLike',
                modifiers: ['private'],
                format: ['camelCase'],
                leadingUnderscore: 'allow',
            },
            {
                // Types (classes, interfaces, type aliases, enums) should be PascalCase
                selector: 'typeLike',
                format: ['PascalCase'],
            },
        ],
        '@typescript-eslint/no-unused-vars': [
            // No unused variables, with some exceptions below
            'warn', // Move from error to warn
            {
                // As a function parameter, unused parameters are allowed
                args: 'none',
            },
        ],
    },
};

/**
 * Overrides to the type checked rulesets
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const azExtTypeCheckedOverrides: EslintConfig = {
    rules: {
        '@typescript-eslint/prefer-nullish-coalescing': [
            'error', // Enforce use of nullish coalescing over || where appropriate
            {
                ignorePrimitives: {
                    string: true, // Except for strings to avoid changing behavior
                    boolean: true, // And booleans
                    number: true, // And numbers
                },
            },
        ],
    },
};

/**
 * Overrides to the strict rulesets
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const azExtStrictOverrides: EslintConfig = {
    rules: {
        '@typescript-eslint/restrict-template-expressions': [
            // Loosen restrictions on template expressions to allow more types
            'warn', // Move from error to warn
            {
                allowArray: true, // Allow arrays
                allowBoolean: true, // Allow booleans
                allowNullish: true, // Allow null and undefined
                allowNumber: true, // Allow numbers
            },
        ],
    },
};

/**
 * A config that enforces lazy imports for @azure/* packages to reduce extension activation time
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const lazyImportAzurePackages = lazyImportRuleConfig(['@azure/*', '!@azure/ms-rest-azure-env']);

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

/**
 * Global ignores that should apply to all projects
 * @note This is exported but not meant to be used in isolation, rather as a building block for other configs
 */
export const ignoresConfig: EslintConfig = globalIgnores([
    'node_modules/**',
    'out/**',
    'dist/**',
    '**/*.d.ts',
    '.vscode-test/**',
    '.vscode-test.mjs',
    'esbuild*.mjs',
    'eslint.config.mjs',
    'main.js',
    'main.mjs',
    '**/test/testProjects/**'
]);

/**
 * Recommended ESLint configuration for Azure extensions
 */
export const azExtEslintRecommended: EslintConfig[] = defineConfig(
    ignoresConfig,
    eslint.configs.recommended,
    tseslint.configs.recommended,
    tseslint.configs.stylistic,
    azExtUniversalRules,
    azExtCopyrightHeaderRule,
    azExtTestRules,
    azExtStylisticRules,
);

/**
 * Recommended ESLint configuration for Azure extensions with extra type-checked rules enabled
 */
export const azExtEslintRecommendedTypeChecked: EslintConfig[] = defineConfig(
    ignoresConfig,
    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    azExtUniversalRules,
    azExtCopyrightHeaderRule,
    azExtTestRules,
    azExtStylisticRules,
    azExtTypeCheckedOverrides,
);

/**
 * Strict ESLint configuration for Azure extensions
 */
export const azExtEslintStrict: EslintConfig[] = defineConfig(
    ignoresConfig,
    eslint.configs.recommended,
    tseslint.configs.strict,
    tseslint.configs.stylistic,
    azExtUniversalRules,
    azExtCopyrightHeaderRule,
    azExtTestRules,
    azExtStylisticRules,
    azExtStrictOverrides,
);

/**
 * Strict ESLint configuration for Azure extensions with extra type-checked rules enabled
 */
export const azExtEslintStrictTypeChecked: EslintConfig[] = defineConfig(
    ignoresConfig,
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    azExtUniversalRules,
    azExtCopyrightHeaderRule,
    azExtTestRules,
    azExtStylisticRules,
    azExtTypeCheckedOverrides,
    azExtStrictOverrides,
);
