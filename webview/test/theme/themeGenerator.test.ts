/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';

// The theme generators read from `document.documentElement` via `getComputedStyle`.
// In Node, neither exists, so install minimal shims on `globalThis`.
//
// IMPORTANT: ES static `import` declarations are hoisted and execute before any
// top-level statements in this file, so installing shims above a static import
// of the module under test would not reliably precede its evaluation (or that
// of its transitive deps, such as `@fluentui/react-components`). We therefore:
//   1. Install shims at module top-level (runs before any hook / test body).
//   2. Dynamically `import()` the module under test inside `suiteSetup`, which
//      is guaranteed to run after (1).
// This keeps shims in place before the module is evaluated, regardless of
// whether a transitive dependency starts touching `document` at import time.
const g = globalThis as any;
const originalDocument = g.document;
const originalGetComputedStyle = g.getComputedStyle;

g.document = { documentElement: {} };
g.getComputedStyle = () => ({
    // Return a valid hex so `getBrandTokensFromPalette` can parse it.
    getPropertyValue: () => '#0078d4',
});

import type { Theme } from '@fluentui/react-components';
type ThemeGenModule = typeof import('../../src/webview/theme/themeGenerator.js');
let themeGen: ThemeGenModule;

suite('(unit) themeGenerator', () => {
    suiteSetup(async () => {
        themeGen = await import('../../src/webview/theme/themeGenerator.js');
    });

    suiteTeardown(() => {
        g.document = originalDocument;
        g.getComputedStyle = originalGetComputedStyle;
    });

    suite('sharedVSCodeTokenOverrides', () => {
        let overrides: Partial<Theme>;
        suiteSetup(() => {
            overrides = themeGen.sharedVSCodeTokenOverrides();
        });

        test('maps brand/accent surface tokens to VS Code button vars', () => {
            assert.strictEqual(overrides.colorBrandBackground, 'var(--vscode-button-background)');
            assert.strictEqual(
                overrides.colorBrandBackgroundHover,
                'var(--vscode-button-hoverBackground, var(--vscode-button-background))',
            );
            assert.strictEqual(
                overrides.colorBrandBackgroundPressed,
                'var(--vscode-button-hoverBackground, var(--vscode-button-background))',
            );
            assert.strictEqual(overrides.colorBrandBackgroundSelected, 'var(--vscode-button-background)');
            assert.strictEqual(overrides.colorNeutralForegroundOnBrand, 'var(--vscode-button-foreground)');
        });

        test('maps focus ring to --vscode-focusBorder', () => {
            assert.strictEqual(overrides.colorStrokeFocus2, 'var(--vscode-focusBorder)');
        });

        test('maps disabled foreground with a button-foreground fallback', () => {
            assert.strictEqual(
                overrides.colorNeutralForegroundDisabled,
                'var(--vscode-disabledForeground, var(--vscode-button-foreground))',
            );
        });

        test('does not include Button-specific neutral surface/stroke tokens (those stay scoped to .fui-Button in global.scss)', () => {
            const buttonScopedKeys = [
                'colorNeutralBackground1Hover',
                'colorNeutralBackground1Pressed',
                'colorNeutralStroke1',
                'colorNeutralStroke1Hover',
                'colorNeutralStroke1Pressed',
                'colorNeutralBackgroundDisabled',
                'colorNeutralStrokeDisabled',
            ] as const;
            for (const key of buttonScopedKeys) {
                assert.strictEqual(
                    (overrides as Record<string, unknown>)[key],
                    undefined,
                    `${key} should not be set theme-wide; it belongs in the .fui-Button SCSS scope`,
                );
            }
        });
    });

    suite('generateAdaptiveLightTheme', () => {
        let theme: Theme;
        suiteSetup(() => {
            theme = themeGen.generateAdaptiveLightTheme();
        });

        test('includes sharedVSCodeTokenOverrides', () => {
            const shared = themeGen.sharedVSCodeTokenOverrides();
            for (const [key, value] of Object.entries(shared)) {
                assert.strictEqual(
                    (theme as Record<string, unknown>)[key],
                    value,
                    `expected shared override "${key}" to be applied to the light theme`,
                );
            }
        });

        test('keeps editor foreground/background overrides for neutral surfaces', () => {
            assert.strictEqual(theme.colorNeutralForeground1, 'var(--vscode-editor-foreground)');
            assert.strictEqual(theme.colorNeutralBackground1, 'var(--vscode-editor-background)');
        });
    });

    suite('generateAdaptiveDarkTheme', () => {
        let theme: Theme;
        suiteSetup(() => {
            theme = themeGen.generateAdaptiveDarkTheme();
        });

        test('includes sharedVSCodeTokenOverrides', () => {
            const shared = themeGen.sharedVSCodeTokenOverrides();
            for (const [key, value] of Object.entries(shared)) {
                assert.strictEqual(
                    (theme as Record<string, unknown>)[key],
                    value,
                    `expected shared override "${key}" to be applied to the dark theme`,
                );
            }
        });

        test('uses button foreground for neutral foreground tokens', () => {
            assert.strictEqual(theme.colorNeutralForeground1, 'var(--vscode-button-foreground)');
            assert.strictEqual(theme.colorNeutralForeground2, 'var(--vscode-button-secondaryForeground)');
        });
    });
});
