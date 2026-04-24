/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';

// The theme generators read from `document.documentElement` via `getComputedStyle`.
// Install minimal DOM shims on the global object before importing the module under
// test so its top-level type references resolve and runtime calls succeed.
const g = globalThis as any;
const originalDocument = g.document;
const originalGetComputedStyle = g.getComputedStyle;

g.document = { documentElement: {} };
g.getComputedStyle = () => ({
    // Return a valid hex so `getBrandTokensFromPalette` can parse it.
    getPropertyValue: () => '#0078d4',
});

import {
    generateAdaptiveDarkTheme,
    generateAdaptiveLightTheme,
    sharedVSCodeTokenOverrides,
} from '../../src/webview/theme/themeGenerator';

suite('(unit) sharedVSCodeTokenOverrides', () => {
    const overrides = sharedVSCodeTokenOverrides();

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

suite('(unit) generateAdaptiveLightTheme', () => {
    const theme = generateAdaptiveLightTheme();

    test('includes sharedVSCodeTokenOverrides', () => {
        const shared = sharedVSCodeTokenOverrides();
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

suite('(unit) generateAdaptiveDarkTheme', () => {
    const theme = generateAdaptiveDarkTheme();

    test('includes sharedVSCodeTokenOverrides', () => {
        const shared = sharedVSCodeTokenOverrides();
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

// Restore globals so other tests in the same process aren't affected.
suite('theme generator test cleanup', () => {
    suiteTeardown(() => {
        g.document = originalDocument;
        g.getComputedStyle = originalGetComputedStyle;
    });
    test('noop', () => {
        assert.ok(true);
    });
});
