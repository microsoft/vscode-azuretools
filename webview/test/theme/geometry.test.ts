/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getPointsOnCurvePath } from '../../src/webview/theme/utils/geometry';
import { type CurvePath } from '../../src/webview/theme/utils/types';

suite('(unit) getPointsOnCurvePath', () => {
    test('returns divisions+1 points for a single curve', () => {
        const curvePath: CurvePath = {
            curves: [{ points: [[0, 0, 0], [50, 0, 0], [100, 0, 0]] }],
        };
        const points = getPointsOnCurvePath(curvePath, 10);
        assert.strictEqual(points.length, 11);
        assert.deepStrictEqual(points[0], [0, 0, 0]);
        assert.deepStrictEqual(points[points.length - 1], [100, 0, 0]);
    });

    test('dedupes duplicate points at curve joins', () => {
        // Two curves that share an endpoint — the seam point should not be duplicated.
        const curvePath: CurvePath = {
            curves: [
                { points: [[0, 0, 0], [25, 0, 0], [50, 0, 0]] },
                { points: [[50, 0, 0], [75, 0, 0], [100, 0, 0]] },
            ],
        };
        const points = getPointsOnCurvePath(curvePath, 10);
        // Without dedup we'd expect 22 points (11 per curve); with dedup we expect 21.
        assert.strictEqual(points.length, 21);

        // No two consecutive points should be equal.
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            assert.ok(
                prev[0] !== curr[0] || prev[1] !== curr[1] || prev[2] !== curr[2],
                `consecutive duplicate at index ${i}`,
            );
        }
    });

    test('defaults to a resolution of 128 per curve', () => {
        const curvePath: CurvePath = {
            curves: [{ points: [[0, 0, 0], [50, 0, 0], [100, 0, 0]] }],
        };
        const points = getPointsOnCurvePath(curvePath);
        assert.strictEqual(points.length, 129);
    });
});
