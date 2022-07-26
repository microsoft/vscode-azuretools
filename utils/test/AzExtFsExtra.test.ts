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
    let jsonFilePath: string;

    const indexHtml: string = 'index.html';
    const jsonFile: string = 'test.json';
    const jsonContents = {
        foo: 99,
        foo2: true,
        lorem: 'ipsum',
        // originally tested NaN, but not a valid JSON value
        // https://stackoverflow.com/questions/1423081/json-left-out-infinity-and-nan-json-status-in-ecmascript
        bar: null
    }

    const nonJsonContents = `{"foo"-"bar"}`;

    const nonExistingPath: string = ' ./path/does/not/exist';
    const nonExistingFilePath = path.join(nonExistingPath, indexHtml);

    suiteSetup(async function (this: Mocha.Context): Promise<void> {
        const workspaceFolders: readonly WorkspaceFolder[] | undefined = workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error("No workspace is open");
        }

        workspacePath = workspaceFolders[0].uri.fsPath;
        ensureDir(workspacePath);

        workspaceFilePath = path.join(workspacePath, indexHtml);
        ensureFile(workspaceFilePath);

        testFolderPath = path.join(workspacePath, `azExtFsExtra${randomUtils.getRandomHexString()}`)
        ensureDir(testFolderPath);

        jsonFilePath = path.join(workspacePath, jsonFile);
        ensureFile(jsonFilePath);
        await workspace.fs.writeFile(Uri.file(jsonFilePath), Buffer.from(JSON.stringify(jsonContents)));
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

    test('readJSON', async () => {
        const fileContents = await AzExtFsExtra.readJSON<any>(jsonFilePath);
        compareObjects(jsonContents, fileContents);
    });

    test('readJSON (non-JSON file)', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());
        ensureDir(fsPath);
        const filePath = path.join(fsPath, jsonFile);

        fs.writeFileSync(filePath, nonJsonContents);
        await assertThrowsAsync(async () => await AzExtFsExtra.readJSON(filePath), /Unexpected number in JSON/);
    });

    test('writeJSON (from string)', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());
        const filePath = path.join(fsPath, indexHtml);
        await AzExtFsExtra.writeJSON(filePath, JSON.stringify(jsonContents));

        const fsFileContents = JSON.parse(fs.readFileSync(filePath).toString());
        compareObjects(jsonContents, fsFileContents);
    });

    test('writeJSON (from object)', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());
        const filePath = path.join(fsPath, indexHtml);
        await AzExtFsExtra.writeJSON(filePath, jsonContents);

        const fsFileContents = JSON.parse(fs.readFileSync(filePath).toString());
        compareObjects(jsonContents, fsFileContents);
    });

    test('writeJSON (non-JSON file)', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());
        ensureDir(fsPath);
        const filePath = path.join(fsPath, jsonFile);

        await assertThrowsAsync(async () => await AzExtFsExtra.writeJSON(filePath, nonJsonContents), /Unexpected number in JSON/);
    });

    test('emptyDir', async () => {
        const fsPath = path.join(testFolderPath, randomUtils.getRandomHexString());
        ensureDir(fsPath);

        for (let i = 0; i < 10; i++) {
            const newFolderPath = path.join(fsPath, `folder-${i.toString()}`);
            const newFilePath = `file-${i.toString()}`
            ensureDir(newFolderPath);
            ensureFile(path.join(fsPath, newFilePath));
            ensureFile(path.join(newFolderPath, newFilePath));
        }

        let files = fs.readdirSync(fsPath);
        assert.strictEqual(files.length, 20);

        await AzExtFsExtra.emptyDir(fsPath);
        files = fs.readdirSync(fsPath);
        assert.strictEqual(files.length, 0);
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

function compareObjects(o1, o2): void {
    for (const [key, value] of Object.entries(o1)) {
        assert.strictEqual(value, o2[key]);
    }
}

