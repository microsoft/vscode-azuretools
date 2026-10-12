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
            const dependencies = new Map<string, string[]>();
            build.onLoad({ filter: /\.s[ac]ss$/ }, async args => {
                const sass = await import('sass');
                try {
                    const result = await sass.compileAsync(args.path, options);
                    const watchFiles = result.loadedUrls
                        .filter(url => url.protocol === 'file:')
                        .map(url => fileURLToPath(url));
                    dependencies.set(args.path, watchFiles);
                    return {
                        contents: result.css,
                        loader: 'css',
                        resolveDir: dirname(args.path),
                        watchFiles,
                    };
                } catch (error) {
                    if (!(error instanceof sass.Exception)) {
                        throw error;
                    }
                    const watchFiles = new Set([args.path, ...(dependencies.get(args.path) ?? [])]);
                    if (error.span.url?.protocol === 'file:') {
                        watchFiles.add(fileURLToPath(error.span.url));
                    }
                    const files = [...watchFiles];
                    dependencies.set(args.path, files);
                    return { errors: [{ text: error.message, detail: error }], watchFiles: files };
                }
            });
        },
    };
}
