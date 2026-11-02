/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mock } from 'node:test';
import * as vscode from 'vscode';
import type { IActionContext } from '../index';
import { AzExtTreeFileSystem, createTestActionContext, openReadOnlyFile, UserCancelledError } from '../src';

interface FileItem {
    id: string;
    content: Uint8Array;
}

class TestFileSystem extends AzExtTreeFileSystem<FileItem> {
    public scheme = 'azuretoolsbinarytest';

    public getFilePath(): string {
        return 'nested folder/favicon.ico';
    }

    public statImpl(_context: IActionContext, item: FileItem): Promise<vscode.FileStat> {
        return Promise.resolve({ type: vscode.FileType.File, ctime: 0, mtime: 0, size: item.content.byteLength });
    }

    public readFileImpl(_context: IActionContext, item: FileItem): Promise<Uint8Array> {
        return Promise.resolve(item.content);
    }

    public writeFileImpl(_context: IActionContext, item: FileItem, content: Uint8Array): Promise<void> {
        item.content = content;
        return Promise.resolve();
    }

    public find(context: IActionContext, uri: vscode.Uri): Promise<FileItem> {
        return this.lookup(context, uri);
    }
}

suite('Binary file opening', () => {
    teardown(() => mock.restoreAll());

    test('showFile registers the same URI/cache identity as showTextDocument before dispatch', async () => {
        const fileSystem = new TestFileSystem();
        const context = await createTestActionContext();
        const item: FileItem = {
            id: '/tenant/subscription/site/slots/staging/file?name=value=1',
            content: Uint8Array.from([0, 255, 128, 192, 175])
        };
        const options: vscode.TextDocumentShowOptions = { preview: false, viewColumn: vscode.ViewColumn.Beside };
        let expectedItem = item;
        let openedUri: vscode.Uri | undefined;
        mock.method(vscode.commands, 'executeCommand', async (command: string, uri: vscode.Uri, actualOptions: vscode.TextDocumentShowOptions) => {
            assert.strictEqual(command, 'vscode.open');
            assert.strictEqual(actualOptions, options);
            assert.strictEqual(await fileSystem.find(context, uri), expectedItem);
            assert.deepStrictEqual(await fileSystem.readFile(uri), expectedItem.content);
            openedUri = uri;
        });
        await fileSystem.showFile(item, options);
        assert.ok(openedUri);
        mock.method(vscode.window, 'showTextDocument', (uri: vscode.Uri) => {
            assert.strictEqual(uri.toString(), openedUri?.toString());
            return Promise.resolve();
        });
        await fileSystem.showTextDocument(item, options);

        const replacement = { ...item, content: Buffer.from('normal text\n', 'utf8') };
        expectedItem = replacement;
        await fileSystem.showFile(replacement, options);
        assert.strictEqual(await fileSystem.find(context, openedUri), replacement);
        const edited = Buffer.from('edited text\n', 'utf8');
        await fileSystem.writeFile(openedUri, edited);
        assert.deepStrictEqual(await fileSystem.readFile(openedUri), edited);
    });

    test('showFile propagates editor cancellation and errors', async () => {
        const fileSystem = new TestFileSystem();
        for (const error of [new UserCancelledError(), new Error('editor failed')]) {
            const command = mock.method(vscode.commands, 'executeCommand', () => Promise.reject(error));
            try {
                await assert.rejects(fileSystem.showFile({ id: 'file', content: new Uint8Array() }), actual => actual === error);
            } finally {
                command.mock.restore();
            }
        }
    });

    test('showFile opens normal text in an editable document and saves its bytes', async () => {
        const fileSystem = new TestFileSystem();
        fileSystem.getFilePath = () => 'normal.txt';
        const item = { id: 'normal-text', content: Buffer.from('normal text \u00e9\n', 'utf8') };
        const registration = vscode.workspace.registerFileSystemProvider(fileSystem.scheme, fileSystem);
        try {
            await fileSystem.showFile(item, { preview: false });
            const editor = vscode.window.activeTextEditor;
            assert.ok(editor);
            assert.strictEqual(editor.document.uri.scheme, fileSystem.scheme);
            assert.strictEqual(editor.document.getText(), 'normal text \u00e9\n');
            assert.strictEqual(await editor.edit(edit => edit.insert(new vscode.Position(0, 0), 'edited ')), true);
            assert.strictEqual(await editor.document.save(), true);
            assert.deepStrictEqual(Buffer.from(item.content), Buffer.from('edited normal text \u00e9\n', 'utf8'));
        } finally {
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            registration.dispose();
        }
    });

    test('reopening a read-only text document reloads equal-length replacement bytes', async () => {
        const node = { label: 'snapshot.txt', fullId: '/tenant/site/snapshot.txt' };
        await openReadOnlyFile(node, Buffer.from('alpha'));
        const editor = vscode.window.activeTextEditor;
        assert.ok(editor);
        const document = editor.document;
        assert.strictEqual(document.getText(), 'alpha');
        const originalStat = await vscode.workspace.fs.stat(document.uri);
        let listener: vscode.Disposable | undefined;
        let timeout: NodeJS.Timeout | undefined;
        try {
            const changed = new Promise<void>((resolve, reject) => {
                timeout = setTimeout(() => reject(new Error(`Read-only document still contains "${document.getText()}" after equal-length replacement.`)), 3000);
                listener = vscode.workspace.onDidChangeTextDocument(event => {
                    if (event.document === document && document.getText() === 'bravo') {
                        resolve();
                    }
                });
            });
            await openReadOnlyFile(node, Buffer.from('bravo'));
            await changed;
            assert.strictEqual(editor.document, document);
            assert.strictEqual(document.getText(), 'bravo');
            const updatedStat = await vscode.workspace.fs.stat(document.uri);
            assert.strictEqual(updatedStat.size, originalStat.size);
            assert.ok(updatedStat.mtime > originalStat.mtime);
            assert.strictEqual(updatedStat.permissions, vscode.FilePermission.Readonly);
        } finally {
            clearTimeout(timeout);
            listener?.dispose();
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
    });

    test('read-only bytes retain their name and identity, refresh content, and cannot be written', async () => {
        const uris: vscode.Uri[] = [];
        mock.method(vscode.commands, 'executeCommand', (command: string, uri: vscode.Uri) => {
            assert.strictEqual(command, 'vscode.open');
            uris.push(uri);
            return Promise.resolve();
        });
        const node = { label: 'favicon.ico', fullId: '/tenant/subscription/site/slot/favicon.ico' };
        const bytes = Uint8Array.from([0, 0, 1, 0, 255, 128, 192, 175]);
        await openReadOnlyFile(node, bytes);
        const uri = uris[0];
        assert.ok(uri.path.endsWith('/favicon.ico'));
        assert.deepStrictEqual(Buffer.from(await vscode.workspace.fs.readFile(uri)), Buffer.from(bytes));
        assert.strictEqual(vscode.workspace.fs.isWritableFileSystem(uri.scheme), false);
        bytes.fill(42);
        assert.notDeepStrictEqual(Buffer.from(await vscode.workspace.fs.readFile(uri)), Buffer.from(bytes));
        const stat = await vscode.workspace.fs.stat(uri);
        assert.strictEqual(stat.size, bytes.byteLength);
        assert.strictEqual(stat.permissions, vscode.FilePermission.Readonly);
        await assert.rejects(async () => await vscode.workspace.fs.writeFile(uri, bytes));

        const text = Buffer.from('normal text \u00e9\n', 'utf8');
        await openReadOnlyFile(node, text);
        assert.strictEqual(uris[1].toString(), uri.toString());
        assert.deepStrictEqual(Buffer.from(await vscode.workspace.fs.readFile(uri)), text);
        const replacedStat = await vscode.workspace.fs.stat(uri);
        assert.ok(replacedStat.mtime > stat.mtime);
        await openReadOnlyFile({ ...node, fullId: '/another-tenant/subscription/site/slot/favicon.ico' }, text);
        assert.notStrictEqual(uris[2].toString(), uri.toString());
    });
});
