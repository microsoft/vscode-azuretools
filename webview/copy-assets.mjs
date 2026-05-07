/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Copies non-TypeScript assets (`.scss`, etc.) from `src/` into the compiled output
// directories so consumers that import e.g. `@microsoft/vscode-azext-webview/webview/global-styles`
// can resolve the referenced stylesheets.

import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSET_EXTENSIONS = new Set(['.scss', '.css']);

const srcDir = path.resolve(__dirname, 'src');
const targets = [
    path.resolve(__dirname, 'dist', 'esm', 'src'),
    path.resolve(__dirname, 'dist', 'cjs', 'src'),
];

/**
 * Recursively walks `dir` and yields absolute paths of files whose extension is in
 * `ASSET_EXTENSIONS`.
 *
 * @param {string} dir
 * @returns {AsyncGenerator<string>}
 */
async function* walkAssets(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* walkAssets(full);
        } else if (ASSET_EXTENSIONS.has(path.extname(entry.name))) {
            yield full;
        }
    }
}

for (const target of targets) {
    for await (const assetPath of walkAssets(srcDir)) {
        const rel = path.relative(srcDir, assetPath);
        const dest = path.join(target, rel);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(assetPath, dest);
    }
}
