/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Plugin } from 'esbuild';
import { dirname } from 'path';
import { type Options } from 'sass';
import { fileURLToPath } from 'url';

/** Compiles Sass on demand; consumers selecting this plugin must install the optional Sass peer. */
export function sassPlugin(options: Options<'async'> = {}): Plugin {
    return {
        name: 'sass',
        setup(build) {
            build.onLoad({ filter: /\.s[ac]ss$/ }, async args => {
                const sass = await import('sass');
                const result = await sass.compileAsync(args.path, options);
                return {
                    contents: result.css,
                    loader: 'css',
                    resolveDir: dirname(args.path),
                    watchFiles: result.loadedUrls
                        .filter(url => url.protocol === 'file:')
                        .map(url => fileURLToPath(url)),
                };
            });
        },
    };
}
