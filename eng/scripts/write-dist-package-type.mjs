/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The package itself is not marked `"type": "module"`, so without these markers Node would treat
// the `.js` files under dist/esm as CommonJS. That matters because several entrypoints (the mocha
// hooks, the esbuild config, the eslint config) are loaded by Node directly rather than through a
// bundler. Node does recover by reparsing them as ESM, but only after emitting a noisy
// MODULE_TYPELESS_PACKAGE_JSON warning to consumers on every run.
const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

await Promise.all(
    [
        ['esm', 'module'],
        ['cjs', 'commonjs'],
    ].map(async ([dir, type]) => {
        const target = join(distDir, dir);
        await mkdir(target, { recursive: true });
        await writeFile(join(target, 'package.json'), `${JSON.stringify({ type }, undefined, 4)}\n`);
    }),
);
