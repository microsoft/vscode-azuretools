/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import { TreeItem } from 'vscode';
import { TreeElementBase } from '../..';
import { TreeElementStateManager } from '../../src/index'

suite('TreeElementStateManager', () => {
    const state = new TreeElementStateManager();

    const testDescription = 'test description';
    const testItem = {
        id: 'test-1',
        getTreeItem: () => {
            return {
                id: 'test-1',
                label: 'test-1',
                description: testDescription
            }
        }
    } satisfies TreeElementBase;

    // returns a copy of testItem so that we can modify it without affecting other tests
    function getTestItem() {
        return {
            ...testItem,
        };
    }

    const testItemWithChildren = {
        ...testItem,
        id: 'test-2',
        getChildren: () => {
            return [testItem];
        }
    } satisfies TreeElementBase;

    // returns a copy of testItemWithChildren so that we can modify it without affecting other tests
    function getTestItemWithChildren() {
        return {
            ...testItemWithChildren,
        };
    }

    test('wrapItemInStateHandling - getChildren returns unmodified children', async () => {
        const testItemWithChildren = getTestItemWithChildren();
        const wrappedItem = state.wrapItemInStateHandling(testItemWithChildren, async () => { });

        const originalChildren = await (testItemWithChildren as TreeElementBase).getChildren?.();
        const wrappedChildren = await wrappedItem.getChildren?.() ?? [];

        assert.deepEqual(wrappedChildren, originalChildren);
    });

    test('wrapItemInStateHandling - getTreeItem returns an unmodified tree item', async () => {
        const testItemWithChildren = getTestItemWithChildren();
        const wrappedItem = state.wrapItemInStateHandling(testItemWithChildren, async () => { });

        const originalTreeItem = await (testItemWithChildren as TreeElementBase).getTreeItem();
        const wrappedTreeItem = await wrappedItem.getTreeItem();

        assert.deepEqual(wrappedTreeItem, originalTreeItem);
    });

    test('notifyChildrenChanged - calls the refresh callback', async () => {
        const testItemWithChildren = getTestItemWithChildren();

        let calledCount = 0;
        state.wrapItemInStateHandling(testItemWithChildren, async () => {
            calledCount++;
        });

        state.notifyChildrenChanged(testItemWithChildren.id);
        assert.deepEqual(calledCount, 1);
    });

    test('runWithTemporaryDescription - behaves as expected', async () => {
        const testItem = getTestItem();
        const wrappedItem = state.wrapItemInStateHandling(testItem, () => { });
        const originalDescription = (await wrappedItem.getTreeItem()).description;
        assert.strictEqual(originalDescription, testDescription, 'TreeItem.description should be the original description.');

        const temporaryDescription = 'temporary description';
        let updatedDescription: string | boolean | undefined;
        await state.runWithTemporaryDescription(wrappedItem.id, temporaryDescription, async () => {
            updatedDescription = (await wrappedItem.getTreeItem()).description;
        });

        assert.strictEqual(updatedDescription, temporaryDescription, 'TreeItem.description should be the temporary description while the callback is running.');

        const descriptionAfterCallback = (await wrappedItem.getTreeItem()).description;
        assert.strictEqual(descriptionAfterCallback, originalDescription, 'TreeItem.description should be the original description after the callback is done.');
    });

    test('runWithTemporaryDescription - dontRefreshOnRemove option is respected', async () => {
        const testItem = getTestItem();
        let calledCount = 0;
        const wrappedItem = state.wrapItemInStateHandling(testItem, () => {
            calledCount++;
        });

        const temporaryDescription = 'temporary description';
        let updatedDescription: string | boolean | undefined;
        await state.runWithTemporaryDescription(wrappedItem.id, temporaryDescription, async () => {
            updatedDescription = (await wrappedItem.getTreeItem()).description;
            assert.strictEqual(updatedDescription, temporaryDescription, 'TreeItem.description should be the temporary description');
        }, true);

        assert.strictEqual(calledCount, 1);
    });

    test('runWithTemporaryDescription - description should reset when callback throws', async () => {
        const testItem = getTestItem();
        const wrappedItem = state.wrapItemInStateHandling(testItem, () => { });
        try {

            await state.runWithTemporaryDescription(wrappedItem.id, 'temporary description', async () => {
                throw new Error();
            });
        } catch {
            // ignore
        }
        const descriptionAfterCallback = (await wrappedItem.getTreeItem()).description;
        assert.strictEqual(testDescription, descriptionAfterCallback);
    });

    test('runWithTemporaryDescription - errors thrown in callback should bubble up', async () => {
        const testItem = getTestItem();
        const wrappedItem = state.wrapItemInStateHandling(testItem, () => { });
        let throws = false;
        try {
            await state.runWithTemporaryDescription(wrappedItem.id, 'temporary description', async () => {
                throw new Error('test error');
            });
        } catch {
            throws = true;
        }
        assert.strictEqual(throws, true);
    });

    test('showCreatingChild - behaves as expected', async () => {
        const testItemWithChildren = getTestItemWithChildren();
        const wrappedItem = state.wrapItemInStateHandling(testItemWithChildren, () => { });

        const originalChildren = await wrappedItem.getChildren?.() ?? [];

        await state.showCreatingChild(wrappedItem.id, 'Creating...', async () => {
            // do nothing

            const childrenDuringCallback = await wrappedItem.getChildren?.() ?? [];
            assert.strictEqual(childrenDuringCallback.length, originalChildren.length + 1);

            const treeItems: TreeItem[] = [];

            for await (const child of childrenDuringCallback) {
                treeItems.push(await child.getTreeItem());
            }

            const creatingTreeItem = treeItems.find(ti => ti.label === 'Creating...');
            assert.ok(creatingTreeItem);
        });

        const childrenAfterCallback = await wrappedItem.getChildren?.() ?? [];
        assert.strictEqual(childrenAfterCallback.length, originalChildren.length);

        const treeItems = await getTreeItems(childrenAfterCallback);
        const creatingTreeItem = treeItems.find(ti => ti.label === 'Creating...');
        assert.strictEqual(creatingTreeItem, undefined, 'Creating... tree item should be removed after the callback is done.');
    });
});

async function getTreeItems(children: TreeElementBase[]): Promise<TreeItem[]> {
    const treeItems: TreeItem[] = [];

    for await (const child of children) {
        treeItems.push(await child.getTreeItem());
    }

    return treeItems;
}
