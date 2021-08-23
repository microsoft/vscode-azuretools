/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { dirname } from 'path';
import { FileStat, FileType, Uri, workspace } from 'vscode';
import { parseError } from '../parseError';

export namespace AzExtFsExtra {
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
                const dir: string = dirname(uri.fsPath);
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

    export function readFileSync(resource: Uri | string): string {
        const data = void readFile(resource)
        while (!data) {
            // wait for readFile to resolve
        }

        return data;
    }

    export async function writeFile(resource: Uri | string, contents: string): Promise<void> {
        const uri = convertToUri(resource);
        await workspace.fs.writeFile(uri, Buffer.from(contents));
    }

    export async function pathExists(resource: Uri | string): Promise<boolean> {
        let stats: FileStat | undefined;
        const uri = convertToUri(resource);
        try {
            stats = await workspace.fs.stat(uri);
        } catch { /*ignore*/ }
        return !!stats;
    }

    function convertToUri(resource: Uri | string): Uri {
        return typeof resource === 'string' ? Uri.file(resource) : resource;
    }
}
