/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'path';
import { Uri } from 'vscode';
import { createTestActionContext } from '@microsoft/vscode-azext-dev';
import { getDeployFsPath } from '../src/deploy/getDeployFsPath';
import { assertThrowsAsync } from './assertThrowsAsync';
import { testWorkspaceRoot } from './global.test';

suite("getDeployFsPath", () => {
    type TestFolder = { name: string; path?: string; }
    const testFolders: TestFolder[] = [
        { name: 'deploy' },
        { name: 'deploy1' },
        { name: 'sub1', path: 'deploy1/sub1' },
        { name: 'sub2', path: 'deploy2/sub2' },
        { name: 'deploy2' }
    ];

    function addSuite(suiteName: string, getInputs: (t: TestFolder) => (string | RegExp)[], getTarget: (t: TestFolder) => any): void {
        suite(suiteName, () => {
            for (const testFolder of testFolders) {
                test(testFolder.name, async () => {
                    const context = await createTestActionContext();
                    const actual = await context.ui.runWithInputs(getInputs(testFolder), async () => {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        return await getDeployFsPath(context, getTarget(testFolder));
                    });
                    assert.strictEqual(path.basename(actual.originalDeployFsPath), testFolder.name);
                    assert.strictEqual(path.basename(actual.effectiveDeployFsPath), testFolder.name);
                    assert.strictEqual(path.basename(actual.workspaceFolder.uri.fsPath), testFolder.name);
                });
            }
        });
    }

    addSuite('string target', () => [], (f) => path.join(testWorkspaceRoot, f.path || f.name));
    addSuite('uri target', () => [], (f) => Uri.file(path.join(testWorkspaceRoot, f.path || f.name)));
    addSuite('undefined target', (f) => [f.name], () => undefined);
    addSuite('undefined target using browse', (f) => [/browse/i, path.join(testWorkspaceRoot, f.path || f.name)], () => undefined);
    addSuite('object target', (f) => [f.name], () => { return {}; });

    test(`outside of workspace`, async () => {
        const context = await createTestActionContext();
        await assertThrowsAsync(async () => await getDeployFsPath(context, testWorkspaceRoot), /cancelled/i);
        await assertThrowsAsync(async () => await getDeployFsPath(context, Uri.file(testWorkspaceRoot)), /cancelled/i);
    });
});
