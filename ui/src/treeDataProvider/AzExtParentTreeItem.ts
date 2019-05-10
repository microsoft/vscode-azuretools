/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from 'vscode';
import { IAzureQuickPickItem, IAzureQuickPickOptions, ISubscriptionRoot } from '../..';
import * as types from '../..';
import { NotImplementedError } from '../errors';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzExtTreeItem } from './AzExtTreeItem';
import { GenericTreeItem } from './GenericTreeItem';
import { IAzExtParentTreeItemInternal } from './InternalInterfaces';
import { loadingIconPath, loadMoreLabel } from './treeConstants';

export abstract class AzExtParentTreeItem<TRoot = ISubscriptionRoot> extends AzExtTreeItem<TRoot> implements types.AzExtParentTreeItem<TRoot>, IAzExtParentTreeItemInternal<TRoot> {
    //#region Properties implemented by base class
    public childTypeLabel?: string;
    //#endregion

    public readonly collapsibleState: TreeItemCollapsibleState | undefined = TreeItemCollapsibleState.Collapsed;

    private _cachedChildren: AzExtTreeItem<TRoot>[] = [];
    private _creatingTreeItems: AzExtTreeItem<TRoot>[] = [];
    private _clearCache: boolean = true;
    private _loadMoreChildrenTask: Promise<void> | undefined;
    private _initChildrenTask: Promise<void> | undefined;

    public async getCachedChildren(): Promise<AzExtTreeItem<TRoot>[]> {
        if (this._clearCache) {
            this._initChildrenTask = this.loadMoreChildren();
        }

        if (this._initChildrenTask) {
            await this._initChildrenTask;
        }

        return this._cachedChildren;
    }

    public get creatingTreeItems(): AzExtTreeItem<TRoot>[] {
        return this._creatingTreeItems;
    }

    //#region Methods implemented by base class
    public abstract loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem<TRoot>[]>;
    public abstract hasMoreChildrenImpl(): boolean;
    // tslint:disable-next-line:no-any
    public createChildImpl?(showCreatingTreeItem: (label: string) => void, userOptions?: any): Promise<AzExtTreeItem<TRoot>>;
    public pickTreeItemImpl?(expectedContextValue: string | RegExp): AzExtTreeItem<TRoot> | undefined;
    public compareChildrenImpl?(item1: AzExtTreeItem<TRoot>, item2: AzExtTreeItem<TRoot>): number;
    //#endregion

    public clearCache(): void {
        this._clearCache = true;
    }

    public async createChild(userOptions?: {}): Promise<AzExtTreeItem<TRoot>> {
        if (this.createChildImpl) {
            let creatingTreeItem: AzExtTreeItem<TRoot> | undefined;
            try {
                const newTreeItem: AzExtTreeItem<TRoot> = await this.createChildImpl(
                    (label: string): void => {
                        creatingTreeItem = new GenericTreeItem(this, {
                            label: localize('creatingLabel', 'Creating {0}...', label),
                            contextValue: `azureextensionui.creating${label}`,
                            iconPath: loadingIconPath
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

    public async pickChildTreeItem(expectedContextValues: (string | RegExp)[]): Promise<AzExtTreeItem<TRoot>> {
        if (this.pickTreeItemImpl) {
            const children: AzExtTreeItem<TRoot>[] = await this.getCachedChildren();
            for (const val of expectedContextValues) {
                const pickedItem: AzExtTreeItem<TRoot> | undefined = this.pickTreeItemImpl(val);
                if (pickedItem) {
                    const child: AzExtTreeItem<TRoot> | undefined = children.find((ti: AzExtTreeItem<TRoot>) => ti.fullId === pickedItem.fullId);
                    if (child) {
                        return child;
                    }
                }
            }
        }

        const options: IAzureQuickPickOptions = {
            placeHolder: localize('selectTreeItem', 'Select {0}', this.childTypeLabel)
        };
        const getTreeItem: GetTreeItemFunction<TRoot> = (await ext.ui.showQuickPick(this.getQuickPicks(expectedContextValues), options)).data;
        return await getTreeItem();
    }

    public addChildToCache(childToAdd: AzExtTreeItem<TRoot>): void {
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

    public removeChildFromCache(childToRemove: AzExtTreeItem<TRoot>): void {
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
                if (child instanceof AzExtParentTreeItem) {
                    child.clearCache();
                }
            }
            this._cachedChildren = [];
        }

        const sortCallback: (ti1: AzExtTreeItem<TRoot>, ti2: AzExtTreeItem<TRoot>) => number =
            this.compareChildrenImpl
                ? this.compareChildrenImpl
                : (ti1: AzExtTreeItem<TRoot>, ti2: AzExtTreeItem<TRoot>): number => ti1.label.localeCompare(ti2.label);

        const newTreeItems: AzExtTreeItem<TRoot>[] = await this.loadMoreChildrenImpl(this._clearCache);
        this._cachedChildren = this._cachedChildren.concat(newTreeItems).sort(sortCallback);
        this._clearCache = false;
    }

    private async getQuickPicks(expectedContextValues: (string | RegExp)[]): Promise<IAzureQuickPickItem<GetTreeItemFunction<TRoot>>[]> {
        let children: AzExtTreeItem<TRoot>[] = await this.getCachedChildren();
        children = children.filter((ti: AzExtTreeItem<TRoot>) => ti.includeInTreePicker(expectedContextValues));

        const picks: IAzureQuickPickItem<GetTreeItemFunction<TRoot>>[] = children.map((ti: AzExtTreeItem<TRoot>) => {
            return {
                label: ti.label,
                description: ti.description,
                id: ti.fullId,
                data: async (): Promise<AzExtTreeItem<TRoot>> => await Promise.resolve(ti)
            };
        });

        if (this.createChildImpl && this.childTypeLabel) {
            picks.unshift({
                label: localize('treePickerCreateNew', '$(plus) Create New {0}', this.childTypeLabel),
                description: '',
                data: async (): Promise<AzExtTreeItem<TRoot>> => await this.createChild()
            });
        }

        if (this.hasMoreChildrenImpl()) {
            picks.push({
                label: `$(sync) ${loadMoreLabel}`,
                description: '',
                data: async (): Promise<AzExtTreeItem<TRoot>> => {
                    await this.loadMoreChildren();
                    this.treeDataProvider.refreshUIOnly(this);
                    return this;
                }
            });
        }

        return picks;
    }
}

type GetTreeItemFunction<TRoot> = () => Promise<AzExtTreeItem<TRoot>>;
