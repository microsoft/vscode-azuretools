/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type BrandVariants, createDarkTheme, createLightTheme, type Theme } from '@fluentui/react-components';
import { type MonacoBuiltinTheme, type MonacoColors, type MonacoThemeData } from './state/ThemeState';
import { hex_to_LCH, hexColorsFromPalette, type Palette, RGBAToHexA } from './utils';
import { vscodeThemeTokens, vscodeThemeTokenToCSSVar } from './vscodeThemeTokens';

type Options = {
    darkCp?: number;
    lightCp?: number;
    hueTorsion?: number;
};

/**
 * A palette is represented as a continuous curve through LAB space, made of two quadratic bezier curves that start at
 * 0L (black) and 100L (white) and meet at the LAB value of the provided key color.
 *
 * This function takes in a palette as input, which consists of:
 * keyColor:        The primary color in the LCH (Lightness Chroma Hue) color space
 * darkCp, lightCp: The control point of the quadratic beizer curve towards black and white, respectively (between 0-1).
 *                  Higher values move the control point toward the ends of the gamut causing chroma/saturation to
 *                  diminish more slowly near the key color, and lower values move the control point toward the key
 *                  color causing chroma/saturation to diminish more linearly.
 * hueTorsion:      Enables the palette to move through different hues by rotating the curve’s points in LAB space,
 *                  creating a helical curve

 * The function returns a set of brand tokens.
 */
export function getBrandTokensFromPalette(keyColor: string, options: Options = {}) {
    const { darkCp = 2 / 3, lightCp = 1 / 3, hueTorsion = 0 } = options;

    if (!keyColor.startsWith('#')) {
        if (keyColor.startsWith('rgb')) {
            keyColor = RGBAToHexA(keyColor);
        }

        // TODO: If the color is not a hex value
    }

    const brandPalette: Palette = {
        keyColor: hex_to_LCH(keyColor),
        darkCp,
        lightCp,
        hueTorsion,
    };
    const hexColors = hexColorsFromPalette(keyColor, brandPalette, 16, 1);
    return hexColors.reduce((acc: Record<string, string>, hexColor, h) => {
        acc[`${(h + 1) * 10}`] = hexColor;
        return acc;
    }, {}) as BrandVariants;
}

// https://react.fluentui.dev/?path=/docs/concepts-developer-theming--page#overriding-existing-tokens
export const generateAdaptiveLightTheme = (): Theme => {
    const style = getComputedStyle(document.documentElement);
    // Seed the Fluent brand palette from VS Code's primary button color so accent
    // surfaces (primary Button, Link, Checkbox, Switch, ...) match the active
    // VS Code theme instead of Fluent's default blue.
    // `getComputedStyle` can return values with leading whitespace, which would
    // break the `startsWith('#')` / `startsWith('rgb')` checks inside
    // `getBrandTokensFromPalette` — trim defensively.
    const buttonBackground = style.getPropertyValue('--vscode-button-background').trim();
    const brandVSCode: BrandVariants = getBrandTokensFromPalette(buttonBackground);

    return {
        ...createLightTheme(brandVSCode),
        // Theme-wide VS Code token overrides (brand surfaces, focus ring,
        // disabled foreground). Spread before the explicit overrides below so
        // the light-theme-specific values win on key collision.
        ...sharedVSCodeTokenOverrides(),
        // Neutral surface → VS Code editor surface. Fluent defaults produce a
        // pale-gray background that visually clashes with the editor; using
        // the editor tokens keeps webviews feeling native to the active theme.
        colorNeutralForeground1: 'var(--vscode-editor-foreground)',
        colorNeutralForeground1Hover: 'var(--vscode-editor-foreground)',
        colorNeutralForeground1Pressed: 'var(--vscode-editor-foreground)',
        colorNeutralForeground1Selected: 'var(--vscode-editor-foreground)',

        colorNeutralBackground1: 'var(--vscode-editor-background)',
    };
};

export const generateAdaptiveDarkTheme = (): Theme => {
    const style = getComputedStyle(document.documentElement);
    // See generateAdaptiveLightTheme: seeds the Fluent brand palette from the
    // VS Code primary button color. Trimmed defensively — `getComputedStyle`
    // values can have leading whitespace that breaks hex/rgb parsing.
    const buttonBackground = style.getPropertyValue('--vscode-button-background').trim();
    const brandVSCode: BrandVariants = getBrandTokensFromPalette(buttonBackground);

    return {
        ...createDarkTheme(brandVSCode),
        // Theme-wide VS Code token overrides; spread first so the dark-theme
        // specific overrides below take precedence on key collision.
        ...sharedVSCodeTokenOverrides(),
        // In dark VS Code themes, `--vscode-editor-foreground` is typically
        // lower-contrast than `--vscode-button-foreground`; using the button
        // foreground keeps Fluent text legible against dark surfaces.
        colorNeutralForeground1: 'var(--vscode-button-foreground)',
        colorNeutralForeground1Hover: 'var(--vscode-button-foreground)',
        colorNeutralForeground1Pressed: 'var(--vscode-button-foreground)',
        colorNeutralForeground1Selected: 'var(--vscode-button-foreground)',
        // `colorNeutralForeground2` is Fluent's "secondary" text (placeholders,
        // helper text, secondary Button text) — map it to VS Code's secondary
        // button foreground so it stays distinguishable from Foreground1.
        colorNeutralForeground2: 'var(--vscode-button-secondaryForeground)',
        colorNeutralForeground2Hover: 'var(--vscode-button-secondaryForeground)',
        colorNeutralForeground2Pressed: 'var(--vscode-button-secondaryForeground)',
        colorNeutralForeground2Selected: 'var(--vscode-button-secondaryForeground)',

        colorNeutralBackground1: 'var(--vscode-editor-background)',
    };
};

/**
 * VS Code token overrides that are safe to apply theme-wide (not Button-specific).
 *
 * Fluent v9 collapses many semantic surfaces into shared neutral tokens, so a
 * global override for things like `colorNeutralBackground1` would bleed into
 * Textarea / Card / Menu / etc. These overrides are limited to tokens whose
 * VS Code mapping is appropriate across all components that consume them:
 * brand/accent surfaces, the focus ring, and disabled foreground.
 *
 * Button-specific neutral surface/stroke overrides live in `global.scss`
 * scoped to `.fui-Button` because they would conflict with other components
 * if applied globally.
 */
export const sharedVSCodeTokenOverrides = (): Partial<Theme> => ({
    // Accent surface (primary Button, Link, Checkbox, Switch, selected Tab indicator, ...)
    colorBrandBackground: 'var(--vscode-button-background)',
    colorBrandBackgroundHover: 'var(--vscode-button-hoverBackground, var(--vscode-button-background))',
    colorBrandBackgroundPressed: 'var(--vscode-button-hoverBackground, var(--vscode-button-background))',
    colorBrandBackgroundSelected: 'var(--vscode-button-background)',
    colorNeutralForegroundOnBrand: 'var(--vscode-button-foreground)',

    // Focus ring
    colorStrokeFocus2: 'var(--vscode-focusBorder)',

    // Disabled foreground (safe globally; disabled surface/stroke stay scoped to Button)
    colorNeutralForegroundDisabled: 'var(--vscode-disabledForeground, var(--vscode-button-foreground))',
});

export const generateMonacoTheme = (baseTheme: MonacoBuiltinTheme): MonacoThemeData => {
    const style = getComputedStyle(document.documentElement);
    const colors = vscodeThemeTokens
        .map((token) => {
            let color = style.getPropertyValue(vscodeThemeTokenToCSSVar(token));
            if (!color.startsWith('#')) {
                if (color.startsWith('rgb')) {
                    color = RGBAToHexA(color);
                }
            }
            return [token, color];
        })
        .filter(([_, color]) => color !== '');

    return {
        base: baseTheme,
        inherit: true,
        rules: [],
        colors: Object.fromEntries(colors) as MonacoColors,
    };
};
