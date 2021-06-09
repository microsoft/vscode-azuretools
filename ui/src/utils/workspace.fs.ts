/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { dirname } from 'path';
import { FileStat, FileType, Uri, workspace } from 'vscode';
import { parseError } from '../parseError';

export async function ensureFile(path: string): Promise<void> {
    let stats: FileStat | undefined;
    const file = Uri.file(path);
    try {
        stats = await workspace.fs.stat(file);
    } catch { /*ignore*/ }
    if (stats && stats.type === FileType.File) return;

    const dir: string = dirname(path);
    const folder = Uri.file(dir);
    try {
        if ((await workspace.fs.stat(folder)).type !== FileType.Directory) {
            // parent is not a directory
            // This is just to cause an internal ENOTDIR error to be thrown
            await workspace.fs.readDirectory(folder);
        }
    } catch (err) {
        // throws a vscode.FileSystemError
        const pError = parseError(err);
        // If the stat call above failed because the directory doesn't exist, create it
        if (pError && pError.errorType === 'FileNotFound') {
            await workspace.fs.createDirectory(folder);
        } else {
            throw err
        }
    }

    await workspace.fs.writeFile(file, new Uint8Array());
}

export async function readJson(path: string, options?: { throws?: boolean }): Promise<unknown> {
    const jsonUri = Uri.file(path);
    const dataBuffer = await workspace.fs.readFile(jsonUri);

    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return JSON.parse(dataBuffer.toString());
    } catch (error) {
        if (options?.throws) {
            throw error;
        }

        return null;
    }
}
