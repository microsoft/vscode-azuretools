/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { homedir } from 'os';
import * as path from 'path';

export interface LinkTestCacheOptions {
    /** Extension directory containing .vscode-test. Defaults to the current working directory. */
    extensionDir?: string;
    /** Defaults to VSCODE_TEST_CACHE_DIR or ~/.vscode-test-cache; relative paths resolve against cwd. */
    cacheDir?: string;
    /** Explicitly allows replacing a link pointing at a different cache. Never replaces real directories. */
    replaceExistingLink?: boolean;
}

export interface LinkTestCacheResult {
    linkPath: string;
    cacheDir: string;
    action: 'created' | 'unchanged' | 'replaced';
}

function overlaps(first: string, second: string): boolean {
    const relative = path.relative(first, second);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function realpathOrMissing(file: string): Promise<string> {
    try {
        return await fs.realpath(file);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            const parent = path.dirname(file);
            if (parent !== file) {
                return path.join(await realpathOrMissing(parent), path.basename(file));
            }
        }
        throw error;
    }
}

/** Explicitly shares the test download directory. Linked tests must not run concurrently. */
export async function linkVscodeTestCache(options: LinkTestCacheOptions = {}): Promise<LinkTestCacheResult> {
    if (options.extensionDir?.trim() === '' || options.cacheDir?.trim() === '') {
        throw new Error('Test-cache directories must not be empty.');
    }
    const extensionDir = await fs.realpath(path.resolve(options.extensionDir ?? process.cwd()));
    if (!(await fs.stat(extensionDir)).isDirectory()) {
        throw new Error(`Extension directory is not a directory: ${extensionDir}`);
    }
    const linkPath = path.join(extensionDir, '.vscode-test');
    const requestedCache = path.resolve(options.cacheDir ?? (process.env.VSCODE_TEST_CACHE_DIR?.trim() || path.join(homedir(), '.vscode-test-cache')));
    const cacheDir = await realpathOrMissing(requestedCache);
    if (overlaps(linkPath, cacheDir) || overlaps(cacheDir, linkPath)) {
        throw new Error('The test cache must not contain, equal, or be contained by the .vscode-test link.');
    }

    let previousTarget: string | undefined;
    try {
        const existing = await fs.lstat(linkPath);
        if (!existing.isSymbolicLink()) {
            throw new Error(`Refusing to replace an existing file or directory: ${linkPath}`);
        }
        previousTarget = path.resolve(path.dirname(linkPath), await fs.readlink(linkPath));
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
            throw error;
        }
    }

    const sameTarget = previousTarget !== undefined
        && path.relative(await realpathOrMissing(previousTarget), cacheDir) === '';
    if (previousTarget !== undefined && !sameTarget && !options.replaceExistingLink) {
        throw new Error(`The test-cache link points at ${previousTarget}; use replaceExistingLink or --replace to change it.`);
    }
    await fs.mkdir(cacheDir, { recursive: true });
    if (!(await fs.stat(cacheDir)).isDirectory()) {
        throw new Error(`Test cache is not a directory: ${cacheDir}`);
    }
    if (sameTarget) {
        return { linkPath, cacheDir, action: 'unchanged' };
    }
    if (previousTarget === undefined) {
        await fs.symlink(cacheDir, linkPath, 'junction');
        return { linkPath, cacheDir, action: 'created' };
    }

    // Create the replacement before touching the old link; restore it if the final rename fails.
    const replacement = `${linkPath}-${randomUUID()}`;
    await fs.symlink(cacheDir, replacement, 'junction');
    try {
        await fs.unlink(linkPath);
        try {
            await fs.rename(replacement, linkPath);
        } catch (error) {
            try {
                await fs.symlink(previousTarget, linkPath, 'junction');
            } catch (restoreError) {
                throw new AggregateError([error, restoreError], `Failed to replace and restore test-cache link: ${linkPath}`, { cause: restoreError });
            }
            throw error;
        }
    } catch (error) {
        try {
            await fs.unlink(replacement);
        } catch (cleanupError) {
            if (!(cleanupError instanceof Error && 'code' in cleanupError && cleanupError.code === 'ENOENT')) {
                throw new AggregateError([error, cleanupError], `Failed to clean up test-cache replacement: ${replacement}`, { cause: cleanupError });
            }
        }
        throw error;
    }
    return { linkPath, cacheDir, action: 'replaced' };
}
