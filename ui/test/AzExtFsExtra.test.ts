/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import * as fs from 'fs';
import * as path from 'path';
import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { AzExtFsExtra } from '../src/utils/AzExtFsExtra';
import { randomUtils } from '../src/utils/randomUtils';
import { assertThrowsAsync } from './assertThrowsAsync';


suite('AzExtFsExtra', function (this: Mocha.Suite): void {
    let workspacePath: string;
    let testFolderPath: string;
    let workspaceFilePath: string;

    const indexHtml: string = 'index.html';

    const nonExistingPath: string = ' ./path/does/not/exist';
    const nonExistingFilePath = path.join(nonExistingPath, indexHtml);

    suiteSetup(function (this: Mocha.Context): void {
        const workspaceFolders: readonly WorkspaceFolder[] | undefined = workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error("No workspace is open");
        }

        workspacePath = workspaceFolders[0].uri.fsPath;

        workspaceFilePath = path.join(workspacePath, indexHtml);
        ensureFile(workspaceFilePath);

        testFolderPath = path.join(workspacePath, `azExtFsExtra${randomUtils.getRandomHexString()}`)
        ensureDir(testFolderPath);
    });

    suiteTeardown(async function (this: Mocha.Context): Promise<void> {
        await workspace.fs.delete(Uri.file(testFolderPath), { recursive: true })
        console.log(testFolderPath, 'deleted.');
    });

    test('pathExists for directory', async () => {
        assert.strictEqual(await AzExtFsExtra.pathExists(workspacePath), true);
        assert.strictEqual(await AzExtFsExtra.pathExists(nonExistingPath), false);
    });

    test('pathExists for file', async () => {
        assert.strictEqual(await AzExtFsExtra.pathExists(workspaceFilePath), true);
        assert.strictEqual(await AzExtFsExtra.pathExists(nonExistingFilePath), false);
    });

    test('isDirectory properly detects folders', async () => {
        assert.strictEqual(await AzExtFsExtra.isDirectory(workspacePath), true);
        assert.strictEqual(await AzExtFsExtra.isDirectory(workspaceFilePath), false);

    });

    test('isFile properly detects files', async () => {
        assert.strictEqual(await AzExtFsExtra.isFile(workspaceFilePath), true);
        assert.strictEqual(await AzExtFsExtra.isFile(workspacePath), false);
    });

    test('ensureDir that does not exist', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());
        assert.strictEqual(fs.existsSync(fsPath), false);
        await AzExtFsExtra.ensureDir(fsPath);

        assert.strictEqual(isDirectoryFs(fsPath), true);
        assert.strictEqual(fs.existsSync(fsPath), true);
    });

    test('ensureDir that exists as a file errors', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());
        assert.strictEqual(fs.existsSync(fsPath), false);
        ensureFile(fsPath);

        await assertThrowsAsync(async () => await AzExtFsExtra.ensureDir(fsPath), /FileSystemError/);
    });

    test('ensureFile where directory exists', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());

        assert.strictEqual(fs.existsSync(fsPath), false);
        ensureDir(fsPath);
        assert.strictEqual(fs.existsSync(fsPath), true);

        const filePath = path.join(fsPath, indexHtml);
        assert.strictEqual(fs.existsSync(filePath), false);
        await AzExtFsExtra.ensureFile(filePath);

        assert.strictEqual(isFileFs(filePath), true);
        assert.strictEqual(fs.existsSync(filePath), true);
    });

    test('ensureFile where directory does not exist', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());
        const filePath = path.join(fsPath, indexHtml);

        assert.strictEqual(fs.existsSync(filePath), false);
        await AzExtFsExtra.ensureFile(filePath);

        assert.strictEqual(isFileFs(filePath), true);
        assert.strictEqual(fs.existsSync(filePath), true);
    });

    test('ensureFile where directory exists with the same name errors', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());
        assert.strictEqual(fs.existsSync(fsPath), false);
        ensureDir(fsPath);

        await assertThrowsAsync(async () => await AzExtFsExtra.ensureFile(fsPath), /FileSystemError/);
    });

    test('readFile', async () => {
        const fileContents = await AzExtFsExtra.readFile(workspaceFilePath);
        const fsFileContents = fs.readFileSync(workspaceFilePath).toString();

        assert.strictEqual(fileContents, fsFileContents);
    });

    test('writeFile', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());
        const filePath = path.join(fsPath, indexHtml);
        const contents = 'writeFileTest';
        await AzExtFsExtra.writeFile(filePath, contents);

        const fsFileContents = fs.readFileSync(filePath).toString();
        assert.strictEqual(contents, fsFileContents);
    });
});

function isDirectoryFs(fsPath: string): boolean {
    return fs.statSync(fsPath).isDirectory();
}

function isFileFs(fsPath: string): boolean {
    return fs.statSync(fsPath).isFile();
}

function ensureFile(fsPath: string): void {
    if (!fs.existsSync(fsPath)) {
        fs.writeFileSync(fsPath, '');
    }
}

function ensureDir(fsPath: string): void {
    if (!fs.existsSync(fsPath)) {
        fs.mkdirSync(fsPath);
    }
}

