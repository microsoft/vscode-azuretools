/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileChangeType, FilePermission, FileStat, FileSystemError, FileType, TextDocumentShowOptions, workspace } from 'vscode';
import type { IActionContext } from '../index';
import { AzExtTreeFileSystem } from './AzExtTreeFileSystem';
import { ext } from './extensionVariables';
import { randomUtils } from './utils/randomUtils';

interface ReadOnlyFile {
    id: string;
    label: string;
    content: Uint8Array;
    mtime: number;
}

class ReadOnlyFileSystem extends AzExtTreeFileSystem<ReadOnlyFile> {
    public readonly scheme = `azuretoolsreadonly${randomUtils.getRandomHexString(6)}`;

    public getFilePath(item: ReadOnlyFile): string {
        return item.label;
    }

    public statImpl(_context: IActionContext, item: ReadOnlyFile): Promise<FileStat> {
        return Promise.resolve({ type: FileType.File, ctime: 0, mtime: item.mtime, size: item.content.byteLength, permissions: FilePermission.Readonly });
    }

    public readFileImpl(_context: IActionContext, item: ReadOnlyFile): Promise<Uint8Array> {
        return Promise.resolve(item.content.slice());
    }

    public writeFileImpl(): Promise<void> {
        return Promise.reject(FileSystemError.NoPermissions());
    }

    public override writeFile(): Promise<void> {
        return Promise.reject(FileSystemError.NoPermissions());
    }
}

let fileSystem: ReadOnlyFileSystem | undefined;
let lastMtime = 0;

export async function openReadOnlyFile(node: { label: string, fullId: string }, content: Uint8Array, options?: TextDocumentShowOptions): Promise<void> {
    if (!fileSystem) {
        fileSystem = new ReadOnlyFileSystem();
        ext.context.subscriptions.push(workspace.registerFileSystemProvider(fileSystem.scheme, fileSystem, { isReadonly: true }));
    }

    const id = await randomUtils.getPseudononymousStringHash(node.fullId);
    // VS Code uses mtime and size to detect changes, including equal-length snapshots.
    lastMtime = Math.max(Date.now(), lastMtime + 1);
    const item: ReadOnlyFile = {
        id,
        label: node.label,
        content: Uint8Array.from(content),
        mtime: lastMtime
    };
    await fileSystem.showFile(item, options);
    fileSystem.fireSoon({ type: FileChangeType.Changed, item });
}
