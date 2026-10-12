/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Plugin } from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CopyAsset {
    /** Source directory, relative to esbuild's absWorkingDir (or the current working directory). */
    from: string;
    /** Destination directory, relative to esbuild's outdir (or the directory containing outfile). */
    to: string;
    /** Globs relative to from. Defaults to all files recursively; matching files retain their relative paths. */
    include?: string | string[];
}

export interface CopyPluginOptions {
    assets: CopyAsset[];
}

/**
 * Copies assets after every build using Node.js glob and filesystem APIs.
 * Does not independently watch assets or remove previously copied files.
 */
export function copyPlugin(options: CopyPluginOptions): Plugin {
    return {
        name: 'copy-assets',
        setup(build) {
            const workingDir = path.resolve(build.initialOptions.absWorkingDir ?? process.cwd());
            const { outdir, outfile } = build.initialOptions;
            const outputDir = outdir !== undefined
                ? path.resolve(workingDir, outdir)
                : outfile !== undefined ? path.dirname(path.resolve(workingDir, outfile)) : undefined;

            const assets = options.assets.map(asset => {
                if (!asset.from || !asset.to) {
                    throw new Error('copyPlugin requires non-empty source and destination directories.');
                }
                if (!path.isAbsolute(asset.to) && outputDir === undefined) {
                    throw new Error('copyPlugin requires outdir or outfile for relative destinations.');
                }
                return {
                    from: path.resolve(workingDir, asset.from),
                    to: path.resolve(outputDir ?? workingDir, asset.to),
                    include: asset.include ?? '**/*',
                };
            });

            build.onEnd(async () => {
                const warnings: { text: string }[] = [];
                for (const asset of assets) {
                    const files: string[] = [];
                    for await (const file of fs.glob(asset.include, { cwd: asset.from })) {
                        files.push(file);
                    }
                    let copied = false;
                    for (const file of files) {
                        const source = path.resolve(asset.from, file);
                        const relative = path.relative(asset.from, source);
                        if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
                            throw new Error(`copyPlugin pattern matched outside the source directory: ${source}`);
                        }
                        if (!(await fs.stat(source)).isFile()) {
                            continue;
                        }
                        const destination = path.join(asset.to, relative);
                        await fs.mkdir(path.dirname(destination), { recursive: true });
                        await fs.copyFile(source, destination);
                        copied = true;
                    }
                    if (!copied) {
                        warnings.push({ text: `copyPlugin: No files matched ${JSON.stringify(asset.include)} in ${asset.from}.` });
                    }
                }
                return { warnings };
            });
        },
    };
}
