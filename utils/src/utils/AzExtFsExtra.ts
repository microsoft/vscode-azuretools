/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { FileStat, FileType, Uri, workspace } from 'vscode';
import { parseError } from '../parseError';

export namespace AzExtFsExtra {
    export function isVirtualWorkspace(): boolean {
        // based on https://code.visualstudio.com/api/extension-guides/virtual-workspaces#detect-virtual-workspaces-programmatically
        return !!workspace.workspaceFolders &&
            workspace.workspaceFolders.every(f => f.uri.scheme !== 'file');
    }

    export async function isDirectory(resource: Uri | string): Promise<boolean> {
        const uri = convertToUri(resource);
        const stats = await workspace.fs.stat(uri);
        return stats.type === FileType.Directory;
    }

    export async function isFile(resource: Uri | string): Promise<boolean> {
        const uri = convertToUri(resource);
        const stats = await workspace.fs.stat(uri);
        return stats.type === FileType.File;
    }

    export async function ensureDir(resource: Uri | string): Promise<void> {
        const uri = convertToUri(resource);
        try {
            // if it is a file, then we should create the directory
            if (await isDirectory(uri)) return;
        } catch (err) {
            // throws a vscode.FileSystemError is it doesn't exist
            const pError = parseError(err);
            if (pError && pError.errorType === 'FileNotFound') {
                // drop down below to create the directory
            } else {
                throw err
            }
        }

        await workspace.fs.createDirectory(uri);
    }

    export async function ensureFile(resource: Uri | string): Promise<void> {
        const uri = convertToUri(resource);
        try {
            // file exists so exit
            if (await isFile(uri)) return;
        } catch (err) {
            // throws a vscode.FileSystemError is it doesn't exist
            const pError = parseError(err);
            if (pError && pError.errorType === 'FileNotFound') {
                const dir: string = path.dirname(uri.fsPath);
                await ensureDir(dir);
            } else {
                throw err
            }
        }

        await workspace.fs.writeFile(uri, Buffer.from(''));
    }

    export async function readFile(resource: Uri | string): Promise<string> {
        const uri = convertToUri(resource);
        return (await workspace.fs.readFile(uri)).toString();
    }

    export async function writeFile(resource: Uri | string, contents: string): Promise<void> {
        const uri = convertToUri(resource);
        await workspace.fs.writeFile(uri, Buffer.from(contents));
    }

    export async function appendFile(resource: Uri | string, contents: string, separator: string = '\r\n\r\n'): Promise<void> {
        const uri = convertToUri(resource);
        const existingContent = await AzExtFsExtra.readFile(uri);
        await AzExtFsExtra.writeFile(uri, existingContent + seperator + contents);
    }

    export async function pathExists(resource: Uri | string): Promise<boolean> {
        let stats: FileStat | undefined;
        const uri = convertToUri(resource);
        try {
            stats = await workspace.fs.stat(uri);
        } catch { /*ignore*/ }
        return !!stats;
    }

    export async function readJSON<T>(resource: Uri | string): Promise<T> {
        const file = await readFile(resource);
        try {
            return JSON.parse(file) as T;
        } catch (err) {
            const pError = parseError(err);
            if (pError.errorType === 'SyntaxError') {
                throw new Error(`Error parsing JSON file: ${resource}. ${pError.message}`);
            }
            else {
                throw err;
            }
        }
    }

    export async function writeJSON(resource: Uri | string, contents: string | unknown, space: string | number = 2): Promise<void> {
        if (typeof contents === 'string') {
            // ensure string is in JSON object format and has proper spaces
            contents = JSON.parse(contents);
        }

        const stringified = JSON.stringify(contents, undefined, space);
        await writeFile(resource, stringified);
    }

    export async function readDirectory(resource: Uri | string): Promise<{ fsPath: string, name: string, type: FileType }[]> {
        const uri = convertToUri(resource);
        const fileTuples = await workspace.fs.readDirectory(uri);
        // workspace.fs.readDirectory() returns a tuple with the file name and FileType
        // typically, it's more useful to have the full fsPath, so return that as well
        return fileTuples.map(f => { return { fsPath: path.join(uri.fsPath, f[0]), name: f[0], type: f[1] } });
    }

    export async function emptyDir(resource: Uri | string): Promise<void> {
        const uri = convertToUri(resource);
        const files = await workspace.fs.readDirectory(uri);

        await Promise.all(files.map(async file => {
            await workspace.fs.delete(Uri.file(path.join(uri.fsPath, file[0])), { recursive: true })
        }));
    }

    export async function copy(src: Uri | string, dest: Uri | string, options?: { overwrite?: boolean }): Promise<void> {
        const sUri = convertToUri(src);
        const dUri = convertToUri(dest);

        await workspace.fs.copy(sUri, dUri, options);
    }

    export async function deleteResource(resource: Uri | string, options?: { recursive?: boolean, useTrash?: boolean }): Promise<void> {
        const uri = convertToUri(resource);
        await workspace.fs.delete(uri, options);
    }

    function convertToUri(resource: Uri | string): Uri {
        return typeof resource === 'string' ? Uri.file(resource) : resource;
    }
}
