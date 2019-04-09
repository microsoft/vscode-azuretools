/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from 'vscode';
import * as types from '../../index';
import { NotImplementedError } from '../errors';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { treeUtils } from '../utils/treeUtils';
import { AzureTreeItem } from './AzureTreeItem';
import { GenericTreeItem } from './GenericTreeItem';
import { IAzureParentTreeItemInternal } from './InternalInterfaces';

export abstract class AzureParentTreeItem<TRoot = types.ISubscriptionRoot> extends AzureTreeItem<TRoot> implements types.AzureParentTreeItem<TRoot>, IAzureParentTreeItemInternal<TRoot> {
    //#region Properties implemented by base class
    public childTypeLabel?: string;
    //#endregion

    public readonly collapsibleState: TreeItemCollapsibleState | undefined = TreeItemCollapsibleState.Collapsed;

    private _cachedChildren: AzureTreeItem<TRoot>[] = [];
    private _creatingTreeItems: AzureTreeItem<TRoot>[] = [];
    private _clearCache: boolean = true;
    private _loadMoreChildrenTask: Promise<void> | undefined;
    private _initChildrenTask: Promise<void> | undefined;

    public async getCachedChildren(): Promise<AzureTreeItem<TRoot>[]> {
        if (this._clearCache) {
            this._initChildrenTask = this.loadMoreChildren();
        }

        if (this._initChildrenTask) {
            await this._initChildrenTask;
        }

        return this._cachedChildren;
    }

    public get creatingTreeItems(): AzureTreeItem<TRoot>[] {
        return this._creatingTreeItems;
    }

    //#region Methods implemented by base class
    public abstract loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem<TRoot>[]>;
    public abstract hasMoreChildrenImpl(): boolean;
    // tslint:disable-next-line:no-any
    public createChildImpl?(showCreatingTreeItem: (label: string) => void, userOptions?: any): Promise<AzureTreeItem<TRoot>>;
    public pickTreeItemImpl?(expectedContextValue: string | RegExp): AzureTreeItem<TRoot> | undefined;
    public compareChildrenImpl?(item1: AzureTreeItem<TRoot>, item2: AzureTreeItem<TRoot>): number;
    //#endregion

    public clearCache(): void {
        this._clearCache = true;
    }

    public async createChild(userOptions?: {}): Promise<AzureTreeItem<TRoot>> {
        if (this.createChildImpl) {
            let creatingTreeItem: AzureTreeItem<TRoot> | undefined;
            try {
                const newTreeItem: AzureTreeItem<TRoot> = await this.createChildImpl(
                    (label: string): void => {
                        creatingTreeItem = new GenericTreeItem(this, {
                            label: localize('creatingLabel', 'Creating {0}...', label),
                            contextValue: `azureCreating${label}`,
                            iconPath: treeUtils.getThemedIconPath('Loading')
                        });
                        this._creatingTreeItems.push(creatingTreeItem);
                        this.treeDataProvider.refreshUIOnly(this);
                    },
                    userOptions);

                this.addChildToCache(newTreeItem);
                this.treeDataProvider._onTreeItemCreateEmitter.fire(newTreeItem);
                return newTreeItem;
            } finally {
                if (creatingTreeItem) {
                    this._creatingTreeItems.splice(this._creatingTreeItems.indexOf(creatingTreeItem), 1);
                    this.treeDataProvider.refreshUIOnly(this);
                }
            }
        } else {
            throw new NotImplementedError('createChildImpl', this);
        }
    }

    public async pickChildTreeItem(expectedContextValues: (string | RegExp)[]): Promise<AzureTreeItem<TRoot>> {
        if (this.pickTreeItemImpl) {
            const children: AzureTreeItem<TRoot>[] = await this.getCachedChildren();
            for (const val of expectedContextValues) {
                const pickedItem: AzureTreeItem<TRoot> | undefined = this.pickTreeItemImpl(val);
                if (pickedItem) {
                    const child: AzureTreeItem<TRoot> | undefined = children.find((ti: AzureTreeItem<TRoot>) => ti.fullId === pickedItem.fullId);
                    if (child) {
                        return child;
                    }
                }
            }
        }

        const options: types.IAzureQuickPickOptions = {
            placeHolder: localize('selectTreeItem', 'Select {0}', this.childTypeLabel)
        };
        const getTreeItem: GetTreeItemFunction<TRoot> = (await ext.ui.showQuickPick(this.getQuickPicks(expectedContextValues), options)).data;
        return await getTreeItem();
    }

    public addChildToCache(childToAdd: AzureTreeItem<TRoot>): void {
        if (!this._cachedChildren.find((ti) => ti.fullId === childToAdd.fullId)) {
            // set index to the last element by default
            let index: number = this._cachedChildren.length;
            // tslint:disable-next-line:no-increment-decrement
            for (let i: number = 0; i < this._cachedChildren.length; i++) {
                if (childToAdd.label.localeCompare(this._cachedChildren[i].label) < 1) {
                    index = i;
                    break;
                }
            }
            this._cachedChildren.splice(index, 0, childToAdd);
            this.treeDataProvider.refreshUIOnly(this);
        }
    }

    public removeChildFromCache(childToRemove: AzureTreeItem<TRoot>): void {
        const index: number = this._cachedChildren.indexOf(childToRemove);
        if (index !== -1) {
            this._cachedChildren.splice(index, 1);
            this.treeDataProvider.refreshUIOnly(this);
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
            // Just in case implementers of `loadMoreChildrenImpl` re-use the same child node, we want to clear those caches as well
            for (const child of this._cachedChildren) {
                if (child instanceof AzureParentTreeItem) {
                    child.clearCache();
                }
            }
            this._cachedChildren = [];
        }

        const sortCallback: (ti1: AzureTreeItem<TRoot>, ti2: AzureTreeItem<TRoot>) => number =
            this.compareChildrenImpl
                ? this.compareChildrenImpl
                : (ti1: AzureTreeItem<TRoot>, ti2: AzureTreeItem<TRoot>): number => ti1.label.localeCompare(ti2.label);

        const newTreeItems: AzureTreeItem<TRoot>[] = await this.loadMoreChildrenImpl(this._clearCache);
        this._cachedChildren = this._cachedChildren.concat(newTreeItems).sort(sortCallback);
        this._clearCache = false;
    }

    private async getQuickPicks(expectedContextValues: (string | RegExp)[]): Promise<types.IAzureQuickPickItem<GetTreeItemFunction<TRoot>>[]> {
        let children: AzureTreeItem<TRoot>[] = await this.getCachedChildren();
        children = children.filter((ti: AzureTreeItem<TRoot>) => ti.includeInTreePicker(expectedContextValues));

        const picks: types.IAzureQuickPickItem<GetTreeItemFunction<TRoot>>[] = children.map((ti: AzureTreeItem<TRoot>) => {
            return {
                label: ti.label,
                description: ti.description,
                id: ti.fullId,
                data: async (): Promise<AzureTreeItem<TRoot>> => await Promise.resolve(ti)
            };
        });

        if (this.createChildImpl && this.childTypeLabel) {
            picks.unshift({
                label: localize('treePickerCreateNew', '$(plus) Create New {0}', this.childTypeLabel),
                description: '',
                data: async (): Promise<AzureTreeItem<TRoot>> => await this.createChild()
            });
        }

        if (this.hasMoreChildrenImpl()) {
            picks.push({
                label: localize('LoadMore', '$(sync) Load more...'),
                description: '',
                data: async (): Promise<AzureTreeItem<TRoot>> => {
                    await this.loadMoreChildren();
                    this.treeDataProvider.refreshUIOnly(this);
                    return this;
                }
            });
        }

        return picks;
    }
}

type GetTreeItemFunction<TRoot> = () => Promise<AzureTreeItem<TRoot>>;
