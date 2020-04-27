/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as types from '../index';
import { AzExtParentTreeItem } from '../src/treeDataProvider/AzExtParentTreeItem';
import { AzExtTreeDataProvider } from '../src/treeDataProvider/AzExtTreeDataProvider';
import { AzExtTreeItem } from '../src/treeDataProvider/AzExtTreeItem';

// tslint:disable: max-classes-per-file

abstract class ParentTreeItemBase extends AzExtParentTreeItem {
    private _childIndex: number = 0;

    public async loadMoreChildrenImpl(clearCache: boolean, _context: types.IActionContext): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._childIndex = 0;
        }

        const children: AzExtTreeItem[] = [];
        let pageIndex: number = 0;
        const pageSize: number = 2;
        while (pageIndex < pageSize) {
            pageIndex += 1;
            this._childIndex += 1;
            children.push(this.createChildTreeItem(this._childIndex));
        }

        return children;
    }

    public hasMoreChildrenImpl(): boolean {
        return this._childIndex < 10;
    }

    protected abstract createChildTreeItem(index: number): AzExtTreeItem;
}

class RootTreeItem extends ParentTreeItemBase {
    public label: string = 'root';
    public contextValue: types.IContextValue = { id: 'root' };

    protected createChildTreeItem(index: number): AzExtTreeItem {
        return new MiddleTreeItem(this, index);
    }
}

class MiddleTreeItem extends ParentTreeItemBase {
    public label: string;
    public contextValue: types.IContextValue = { id: 'middle' };

    constructor(parent: AzExtParentTreeItem, index: number) {
        super(parent);
        this.label = index.toString();
    }

    protected createChildTreeItem(index: number): AzExtTreeItem {
        return new LeafTreeItem(this, index);
    }
}

class LeafTreeItem extends AzExtTreeItem {
    public label: string;
    public contextValue: types.IContextValue = { id: 'leaf' };

    constructor(parent: AzExtParentTreeItem, index: number) {
        super(parent);
        this.label = index.toString();
    }
}

suite("AzExtTreeDataProvider", () => {
    let root: RootTreeItem;
    let tree: AzExtTreeDataProvider;
    const context: types.IActionContext = { errorHandling: { issueProperties: {} }, telemetry: { measurements: {}, properties: {} } };

    suiteSetup(() => {
        root = new RootTreeItem(undefined);
        tree = new AzExtTreeDataProvider(root, 'test.loadMore');
    });

    test("getCachedChildren", async () => {
        await resetTree();

        const middle: MiddleTreeItem[] = <MiddleTreeItem[]>await root.getCachedChildren(context);
        assert.equal(middle.length, 2);
        assert.equal(root.hasMoreChildrenImpl(), true);

        const first: MiddleTreeItem = middle[0];
        const leaves: AzExtTreeItem[] = await first.getCachedChildren(context);
        assert.equal(leaves.length, 2);
        assert.equal(first.hasMoreChildrenImpl(), true);
    });

    test("loadAllChildren", async () => {
        await resetTree();

        const middle: MiddleTreeItem[] = <MiddleTreeItem[]>await root.loadAllChildren(context);
        assert.equal(middle.length, 10);
        assert.equal(root.hasMoreChildrenImpl(), false);

        const first: MiddleTreeItem = middle[0];
        const leaves: AzExtTreeItem[] = <MiddleTreeItem[]>await first.loadAllChildren(context);
        assert.equal(leaves.length, 10);
        assert.equal(first.hasMoreChildrenImpl(), false);
    });

    async function resetTree(): Promise<void> {
        await root.refresh();
    }

    interface IFindTestCase {
        id: string;
        loadAll: boolean;
        expectedLabel: string | undefined;
        expectedLeafCounts: number[];
    }

    const findTestCases: IFindTestCase[] = [
        { id: '/1', loadAll: false, expectedLabel: '1', expectedLeafCounts: [2, 2] },
        { id: '/3', loadAll: false, expectedLabel: undefined, expectedLeafCounts: [2, 2] },
        { id: '/1/2', loadAll: false, expectedLabel: '2', expectedLeafCounts: [2, 2] },
        { id: '/3/5', loadAll: false, expectedLabel: undefined, expectedLeafCounts: [2, 2] },
        { id: '/none', loadAll: false, expectedLabel: undefined, expectedLeafCounts: [2, 2] },
        { id: '/10', loadAll: false, expectedLabel: undefined, expectedLeafCounts: [2, 2] },
        { id: '/1', loadAll: true, expectedLabel: '1', expectedLeafCounts: [2, 2] },
        { id: '/3', loadAll: true, expectedLabel: '3', expectedLeafCounts: [2, 2, 2, 2] },
        { id: '/1/2', loadAll: true, expectedLabel: '2', expectedLeafCounts: [2, 2] },
        { id: '/3/5', loadAll: true, expectedLabel: '5', expectedLeafCounts: [2, 2, 6, 2] },
        { id: '/none', loadAll: true, expectedLabel: undefined, expectedLeafCounts: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2] },
        { id: '/10', loadAll: true, expectedLabel: '10', expectedLeafCounts: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2] } // https://github.com/Microsoft/vscode-cosmosdb/issues/488
    ];

    for (const testCase of findTestCases) {
        addFindTestCase(testCase);
    }

    function addFindTestCase(testCase: IFindTestCase): void {
        let name: string = `Find "${testCase.id}"`;
        if (testCase.loadAll) {
            name += ' (LoadAll)';
        }

        test(name, async () => {
            await resetTree();

            const result: AzExtTreeItem | undefined = await tree.findTreeItem(testCase.id, { ...context, loadAll: testCase.loadAll });
            assert.equal(result && result.label, testCase.expectedLabel);

            const middles: MiddleTreeItem[] = <MiddleTreeItem[]>await root.getCachedChildren(context);
            assert.equal(middles.length, testCase.expectedLeafCounts.length);

            const leafCounts: number[] = await Promise.all(middles.map(async middle => {
                return (await middle.getCachedChildren(context)).length;
            }));
            assert.deepEqual(leafCounts, testCase.expectedLeafCounts);
        });
    }
});
