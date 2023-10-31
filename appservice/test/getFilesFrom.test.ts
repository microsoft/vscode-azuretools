/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import { getFilesFromGitignore, getFilesFromGlob } from '../src/deploy/runWithZipStream';
import { testWorkspaceRoot } from './global.test';
import assert = require('assert');

suite("getDeployFsPath", () => {
    type TestFolder = { name: string; path?: string; }
    const testFolder: TestFolder = { name: 'getFilesFromTestFolder' };
    const dummyFolders: string[] = ['dir1', 'dir2', 'dir3'];
    const dummyNestedFolders: string[] = ['sub1', 'sub2'];

    const rootPath = path.join(testWorkspaceRoot, testFolder.name);

    suiteSetup(async () => {
        await AzExtFsExtra.ensureDir(rootPath);
        for (const folder of dummyFolders) {
            const folderPath = path.join(rootPath, folder);
            await AzExtFsExtra.ensureDir(folderPath);
            // add some dummy files
            await AzExtFsExtra.writeFile(path.join(folderPath, 'file.txt'), '');
            for (const nestedFolder of dummyNestedFolders) {
                await AzExtFsExtra.ensureDir(path.join(folderPath, nestedFolder));
                await AzExtFsExtra.writeFile(path.join(folderPath, nestedFolder, 'file.txt'), '');
            }
        }

        await AzExtFsExtra.ensureFile(path.join(rootPath, '.gitignore'));
        await AzExtFsExtra.writeFile(path.join(rootPath, '.gitignore'), gitignoreContent);
    });

    suite('getFilesFrom', () => {
        test('getFilesFromGlob', async () => {
            const files = await getFilesFromGlob(rootPath, 'testApp');
            assert.strictEqual(files.length, expectedFiles.length);
            for (const file of files) {
                assert.strictEqual(file, expectedFiles.find(f => f === file));
            }

        });

        test('getFilesFromGitignore', async () => {
            const files = await getFilesFromGitignore(rootPath, '.gitignore');
            assert.strictEqual(files.length, expectedFiles.length);
            for (const file of files) {
                assert.strictEqual(file, expectedFiles.find(f => f === file));
            }
        });
    })

});

const gitignoreContent = `
    dir2
    dir3/sub1
    `;

const expectedFiles = [
    path.join('.gitignore'),
    path.join('dir3', 'sub2', 'file.txt'),
    path.join('dir1', 'file.txt'),
    path.join('dir1', 'sub2', 'file.txt'),
    path.join('dir1', 'sub1', 'file.txt'),
    path.join('dir3', 'file.txt'),
];
