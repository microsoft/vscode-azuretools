/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { hex_to_LCH, hexColorsFromPalette, RGBAToHexA } from '../../src/webview/theme/utils/palettes';

suite('(unit) RGBAToHexA', () => {
    test('converts rgb() to 6-digit hex', () => {
        assert.strictEqual(RGBAToHexA('rgb(255, 0, 0)'), '#ff0000');
        assert.strictEqual(RGBAToHexA('rgb(0, 128, 0)'), '#008000');
    });

    test('converts rgba() and scales alpha to 0-255', () => {
        assert.strictEqual(RGBAToHexA('rgba(255, 0, 0, 1)'), '#ff0000ff');
        assert.strictEqual(RGBAToHexA('rgba(255, 0, 0, 0)'), '#ff000000');
    });

    test('pads single-digit hex components', () => {
        // 1,2,3 -> #010203
        assert.strictEqual(RGBAToHexA('rgb(1, 2, 3)'), '#010203');
    });

    test('drops the alpha channel when forceRemoveAlpha is true', () => {
        assert.strictEqual(RGBAToHexA('rgba(255, 0, 0, 0.5)', true), '#ff0000');
    });
});

suite('(unit) hex_to_LCH', () => {
    test('maps pure black to L≈0', () => {
        const [l] = hex_to_LCH('#000000');
        assert.ok(l < 0.5, `expected L≈0 for black, got ${l}`);
    });

    test('maps pure white to L≈100', () => {
        const [l] = hex_to_LCH('#ffffff');
        assert.ok(l > 99.5, `expected L≈100 for white, got ${l}`);
    });

    test('produces near-zero chroma for neutral greys', () => {
        const [, c] = hex_to_LCH('#808080');
        assert.ok(Math.abs(c) < 1, `expected near-zero chroma for grey, got ${c}`);
    });

    test('produces non-trivial chroma for saturated colors', () => {
        const [, c] = hex_to_LCH('#ff0000');
        assert.ok(c > 50, `expected saturated red to have high chroma, got ${c}`);
    });
});

suite('(unit) hexColorsFromPalette', () => {
    test('returns the requested number of hex colors', () => {
        const keyColor = '#0078d4';
        const palette = { keyColor: hex_to_LCH(keyColor), darkCp: 2 / 3, lightCp: 1 / 3, hueTorsion: 0 };
        const shades = hexColorsFromPalette(keyColor, palette, 16);
        assert.strictEqual(shades.length, 16);
        for (const shade of shades) {
            assert.match(shade, /^#[0-9a-f]{6}$/i, `expected hex color, got ${shade}`);
        }
    });

    test('is deterministic', () => {
        const keyColor = '#0078d4';
        const palette = { keyColor: hex_to_LCH(keyColor), darkCp: 2 / 3, lightCp: 1 / 3, hueTorsion: 0 };
        const a = hexColorsFromPalette(keyColor, palette, 8);
        const b = hexColorsFromPalette(keyColor, palette, 8);
        assert.deepStrictEqual(a, b);
    });
});
