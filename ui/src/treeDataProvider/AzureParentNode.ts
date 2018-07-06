/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'vscode';
import { IAzureNode, IAzureParentTreeItem, IAzureQuickPickItem, IAzureQuickPickOptions, IAzureTreeItem } from '../../index';
import { NotImplementedError } from '../errors';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzureNode, IAzureParentNodeInternal } from './AzureNode';
import { CreatingTreeItem } from './CreatingTreeItem';
import { LoadMoreTreeItem } from './LoadMoreTreeItem';

export class AzureParentNode<T extends IAzureParentTreeItem = IAzureParentTreeItem> extends AzureNode<T> implements IAzureParentNodeInternal {
    private _cachedChildren: AzureNode[] = [];
    private _creatingNodes: AzureNode[] = [];
    private _onNodeCreateEmitter: EventEmitter<IAzureNode>;
    private _clearCache: boolean = true;
    private _loadMoreChildrenTask: Promise<void> | undefined;
    private _initChildrenTask: Promise<void> | undefined;

    public constructor(parent: IAzureParentNodeInternal | undefined, treeItem: T, onNodeCreateEmitter: EventEmitter<IAzureNode>) {
        super(parent, treeItem);
        this._onNodeCreateEmitter = onNodeCreateEmitter;
    }

    public async getCachedChildren(): Promise<AzureNode[]> {
        if (this._clearCache) {
            this._initChildrenTask = this.loadMoreChildren();
        }

        if (this._initChildrenTask) {
            await this._initChildrenTask;
        }

        return this._cachedChildren;
    }

    public get creatingNodes(): AzureNode[] {
        return this._creatingNodes;
    }

    public clearCache(): void {
        this._clearCache = true;
    }

    public async createChild(userOptions?: {}): Promise<AzureNode> {
        if (this.treeItem.createChild) {
            let creatingNode: AzureNode | undefined;
            try {
                const newTreeItem: IAzureTreeItem = await this.treeItem.createChild(
                    this,
                    (label: string): void => {
                        creatingNode = new AzureNode(this, new CreatingTreeItem(label));
                        this._creatingNodes.push(creatingNode);
                        //tslint:disable-next-line:no-floating-promises
                        this.treeDataProvider.refresh(this, false);
                    },
                    userOptions);

                const newNode: AzureNode = this.createNewNode(newTreeItem);
                await this.addNodeToCache(newNode);
                this._onNodeCreateEmitter.fire(newNode);
                return newNode;
            } finally {
                if (creatingNode) {
                    this._creatingNodes.splice(this._creatingNodes.indexOf(creatingNode), 1);
                    await this.treeDataProvider.refresh(this, false);
                }
            }
        } else {
            throw new NotImplementedError('createChild', this.treeItem);
        }
    }

    public async pickChildNode(expectedContextValues: string[]): Promise<AzureNode> {
        if (this.treeItem.pickTreeItem) {
            const children: AzureNode[] = await this.getCachedChildren();
            for (const val of expectedContextValues) {
                const pickedItem: IAzureTreeItem | undefined = this.treeItem.pickTreeItem(val);
                if (pickedItem) {
                    const node: AzureNode | undefined = children.find((n: AzureNode) => {
                        return (!!pickedItem.id && n.treeItem.id === pickedItem.id) || (n.treeItem.label === pickedItem.label);
                    });
                    if (node) {
                        return node;
                    }
                }
            }
        }

        const options: IAzureQuickPickOptions = {
            placeHolder: localize('selectNode', 'Select a {0}', this.treeItem.childTypeLabel)
        };
        const getNode: GetNodeFunction = (await ext.ui.showQuickPick(this.getQuickPicks(expectedContextValues), options)).data;
        return await getNode();
    }

    public async addNodeToCache(node: AzureNode): Promise<void> {
        // set index to the last element by default
        let index: number = this._cachedChildren.length;
        // tslint:disable-next-line:no-increment-decrement
        for (let i: number = 0; i < this._cachedChildren.length; i++) {
            if (node.treeItem.label.localeCompare(this._cachedChildren[i].treeItem.label) < 1) {
                index = i;
                break;
            }
        }
        this._cachedChildren.splice(index, 0, node);
        await this.treeDataProvider.refresh(this, false);
    }

    public async removeNodeFromCache(node: AzureNode): Promise<void> {
        const index: number = this._cachedChildren.indexOf(node);
        if (index !== -1) {
            this._cachedChildren.splice(index, 1);
            await this.treeDataProvider.refresh(this, false);
        }
    }

    public async loadMoreChildren(): Promise<void> {
        if (this._loadMoreChildrenTask) {
            await this._loadMoreChildrenTask;
        } else {
            this._loadMoreChildrenTask = this.loadMoreChildrenInternal();
            try {
                await this._loadMoreChildrenTask;
            } finally {
                this._loadMoreChildrenTask = undefined;
            }
        }
    }

    private async loadMoreChildrenInternal(): Promise<void> {
        if (this._clearCache) {
            this._cachedChildren = [];
        }

        const sortCallback: (n1: IAzureNode, n2: IAzureNode) => number =
            this.treeItem.compareChildren
                ? this.treeItem.compareChildren
                : (n1: AzureNode, n2: AzureNode): number => n1.treeItem.label.localeCompare(n2.treeItem.label);

        const newTreeItems: IAzureTreeItem[] = await this.treeItem.loadMoreChildren(this, this._clearCache);
        this._cachedChildren = this._cachedChildren
            .concat(newTreeItems.map((t: IAzureTreeItem) => this.createNewNode(t)))
            .sort(sortCallback);
        this._clearCache = false;
    }

    private async getQuickPicks(expectedContextValues: string[]): Promise<IAzureQuickPickItem<GetNodeFunction>[]> {
        let nodes: AzureNode[] = await this.getCachedChildren();
        nodes = nodes.filter((node: AzureNode) => node.includeInNodePicker(expectedContextValues));

        const picks: IAzureQuickPickItem<GetNodeFunction>[] = nodes.map((n: AzureNode) => {
            return {
                label: n.treeItem.label,
                description: '',
                id: n.id,
                data: async (): Promise<AzureNode> => await Promise.resolve(n)
            };
        });

        if (this.treeItem.createChild && this.treeItem.childTypeLabel) {
            picks.unshift({
                label: localize('nodePickerCreateNew', '$(plus) Create New {0}', this.treeItem.childTypeLabel),
                description: '',
                data: async (): Promise<AzureNode> => await this.createChild()
            });
        }

        if (this.treeItem.hasMoreChildren()) {
            picks.push({
                label: LoadMoreTreeItem.label,
                description: '',
                data: async (): Promise<AzureNode> => {
                    await this.loadMoreChildren();
                    await this.treeDataProvider.refresh(this, false);
                    return this;
                }
            });
        }

        return picks;
    }

    private createNewNode(treeItem: IAzureTreeItem): AzureNode {
        const parentTreeItem: IAzureParentTreeItem = <IAzureParentTreeItem>treeItem;
        // tslint:disable-next-line:strict-boolean-expressions
        if (parentTreeItem.loadMoreChildren) {
            return new AzureParentNode(this, parentTreeItem, this._onNodeCreateEmitter);
        } else {
            return new AzureNode(this, treeItem);
        }
    }
}

type GetNodeFunction<T extends IAzureTreeItem = IAzureTreeItem> = () => Promise<AzureNode<T>>;
