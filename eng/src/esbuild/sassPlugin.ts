/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type OnLoadResult, type Plugin } from 'esbuild';
import { dirname, resolve, sep } from 'path';
import { type FileImporter, type Options as SassCompileOptions } from 'sass';
import { fileURLToPath, pathToFileURL } from 'url';

interface WatchDependencies {
    watchFiles: string[];
    watchDirs: string[];
}

/** Compiles Sass on demand; consumers selecting this plugin must install the optional Sass peer. */
export function sassPlugin(options: SassCompileOptions<'async'> = {}): Plugin {
    return {
        name: 'sass',
        setup(build) {
            const dependencies = new Map<string, WatchDependencies>();

            build.onLoad({ filter: /\.s[ac]ss$/ }, async args => {
                const sass = await loadSass();
                const watchDirs = new Set<string>();
                let watchFiles: string[];
                let output: OnLoadResult;

                try {
                    const result = await sass.compileAsync(args.path, {
                        ...options,
                        importers: [
                            createImportObserver(args.path, options.loadPaths ?? [], watchDirs),
                            ...(options.importers ?? []),
                        ],
                    });
                    watchFiles = result.loadedUrls
                        .filter(url => url.protocol === 'file:')
                        .map(url => fileURLToPath(url));
                    output = {
                        contents: result.css,
                        loader: 'css',
                        resolveDir: dirname(args.path),
                    };
                } catch (error) {
                    if (!(error instanceof sass.Exception)) {
                        throw error;
                    }

                    const previous = dependencies.get(args.path);
                    const files = new Set([args.path, ...(previous?.watchFiles ?? [])]);
                    if (error.span.url?.protocol === 'file:') {
                        files.add(fileURLToPath(error.span.url));
                    }
                    watchFiles = [...files];
                    for (const dir of previous?.watchDirs ?? []) {
                        watchDirs.add(dir);
                    }

                    output = {
                        errors: [{ text: error.message, detail: error }],
                    };
                }

                for (const file of watchFiles) {
                    watchDirs.add(dirname(file));
                }
                const watched = { watchFiles, watchDirs: [...watchDirs] };
                dependencies.set(args.path, watched);
                return { ...output, ...watched };
            });
        },
    };
}

function createImportObserver(entryPath: string, loadPaths: string[], watchDirs: Set<string>): FileImporter<'async'> {
    return {
        findFileUrl(url, { containingUrl }) {
            const searchBases = [
                containingUrl ?? pathToFileURL(entryPath),
                ...loadPaths.map(loadPath => pathToFileURL(resolve(loadPath) + sep)),
            ];
            for (const base of searchBases) {
                if (base.protocol !== 'file:') {
                    continue;
                }
                const candidate = new URL(url, base);
                if (candidate.protocol !== 'file:') {
                    continue;
                }

                const file = fileURLToPath(candidate);
                watchDirs.add(dirname(file));
                watchDirs.add(file); // The import may resolve to an index file in this directory.
            }

            // Observe filesystem candidates without handling the import or changing resolution precedence.
            return null;
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
