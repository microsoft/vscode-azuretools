/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Plugin } from 'esbuild';
import { dirname, resolve, sep } from 'path';
import { type Options as SassCompileOptions } from 'sass';
import { fileURLToPath, pathToFileURL } from 'url';

/** Compiles Sass on demand; consumers selecting this plugin must install the optional Sass peer. */
export function sassPlugin(options: SassCompileOptions<'async'> = {}): Plugin {
    return {
        name: 'sass',
        setup(build) {
            const dependencies = new Map<string, { watchFiles: string[]; watchDirs: string[] }>();

            build.onLoad({ filter: /\.s[ac]ss$/ }, async args => {
                const sass = await loadSass();
                const watchDirs = new Set<string>();

                try {
                    const result = await sass.compileAsync(args.path, {
                        ...options,
                        importers: [{
                            // Observe unresolved filesystem candidates without changing Sass's resolution order.
                            findFileUrl(url, { containingUrl }) {
                                const bases = [
                                    containingUrl ?? pathToFileURL(args.path),
                                    ...(options.loadPaths ?? []).map(loadPath => pathToFileURL(resolve(loadPath) + sep)),
                                ];
                                for (const base of bases) {
                                    if (base.protocol !== 'file:') {
                                        continue;
                                    }
                                    const candidate = new URL(url, base);
                                    if (candidate.protocol === 'file:') {
                                        const file = fileURLToPath(candidate);
                                        watchDirs.add(dirname(file));
                                        watchDirs.add(file);
                                    }
                                }
                                return null;
                            },
                        }, ...(options.importers ?? [])],
                    });
                    const watchFiles = result.loadedUrls
                        .filter(url => url.protocol === 'file:')
                        .map(url => fileURLToPath(url));
                    for (const file of watchFiles) {
                        watchDirs.add(dirname(file));
                    }
                    const watched = { watchFiles, watchDirs: [...watchDirs] };
                    dependencies.set(args.path, watched);

                    return {
                        contents: result.css,
                        loader: 'css',
                        resolveDir: dirname(args.path),
                        ...watched,
                    };
                } catch (error) {
                    if (!(error instanceof sass.Exception)) {
                        throw error;
                    }

                    const previous = dependencies.get(args.path);
                    const watchFiles = new Set([args.path, ...(previous?.watchFiles ?? [])]);
                    if (error.span.url?.protocol === 'file:') {
                        watchFiles.add(fileURLToPath(error.span.url));
                    }
                    for (const file of watchFiles) {
                        watchDirs.add(dirname(file));
                    }
                    for (const dir of previous?.watchDirs ?? []) {
                        watchDirs.add(dir);
                    }

                    const watched = { watchFiles: [...watchFiles], watchDirs: [...watchDirs] };
                    dependencies.set(args.path, watched);

                    return {
                        errors: [{ text: error.message, detail: error }],
                        ...watched,
                    };
                }
            });
        },
    };
}

function loadSass(): Promise<typeof import('sass')> {
    return import('sass').catch((error: unknown) => {
        if (
            error instanceof Error
            && 'code' in error
            && error.code === 'ERR_MODULE_NOT_FOUND'
            && error.message.includes("Cannot find package 'sass'")
        ) {
            throw new Error(
                'Sass stylesheets require the optional "sass" peer dependency. Install it with npm install --save-dev sass.',
                { cause: error },
            );
        }

        throw error;
    });
}
