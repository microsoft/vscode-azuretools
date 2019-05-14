/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { commands, TreeItemCollapsibleState } from 'vscode';
import * as types from '../../index';
import { NotImplementedError } from '../errors';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzExtTreeItem } from './AzExtTreeItem';
import { GenericTreeItem } from './GenericTreeItem';
import { IAzExtParentTreeItemInternal, isAzExtParentTreeItem } from './InternalInterfaces';
import { loadingIconPath, loadMoreLabel } from './treeConstants';

export abstract class AzExtParentTreeItem extends AzExtTreeItem implements types.AzExtParentTreeItem, IAzExtParentTreeItemInternal {
    //#region Properties implemented by base class
    public childTypeLabel?: string;
    public autoSelectInTreeItemPicker?: boolean;
    //#endregion

    public readonly collapsibleState: TreeItemCollapsibleState | undefined = TreeItemCollapsibleState.Collapsed;
    public readonly _isAzExtParentTreeItem: boolean = true;

    private _cachedChildren: AzExtTreeItem[] = [];
    private _creatingTreeItems: AzExtTreeItem[] = [];
    private _clearCache: boolean = true;
    private _loadMoreChildrenTask: Promise<void> | undefined;
    private _initChildrenTask: Promise<void> | undefined;

    public async getCachedChildren(): Promise<AzExtTreeItem[]> {
        if (this._clearCache) {
            this._initChildrenTask = this.loadMoreChildren();
        }

        if (this._initChildrenTask) {
            await this._initChildrenTask;
        }

        return this._cachedChildren;
    }

    public get creatingTreeItems(): AzExtTreeItem[] {
        return this._creatingTreeItems;
    }

    //#region Methods implemented by base class
    public abstract loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]>;
    public abstract hasMoreChildrenImpl(): boolean;
    // tslint:disable-next-line:no-any
    public createChildImpl?(showCreatingTreeItem: (label: string) => void, userOptions?: any): Promise<AzExtTreeItem>;
    public pickTreeItemImpl?(expectedContextValues: (string | RegExp)[]): AzExtTreeItem | undefined | Promise<AzExtTreeItem | undefined>;
    //#endregion

    public clearCache(): void {
        this._clearCache = true;
    }

    public async createChild<T extends types.AzExtTreeItem>(userOptions?: {}): Promise<T> {
        if (this.createChildImpl) {
            let creatingTreeItem: AzExtTreeItem | undefined;
            try {
                const newTreeItem: AzExtTreeItem = await this.createChildImpl(
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
                // tslint:disable-next-line: no-any
                return <T><any>newTreeItem;
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

    public compareChildrenImpl(item1: AzExtTreeItem, item2: AzExtTreeItem): number {
        return item1.effectiveLabel.localeCompare(item2.effectiveLabel);
    }

    public async pickChildTreeItem(expectedContextValues: (string | RegExp)[]): Promise<AzExtTreeItem> {
        if (this.pickTreeItemImpl) {
            const children: AzExtTreeItem[] = await this.getCachedChildren();
            const pickedItem: AzExtTreeItem | undefined = await this.pickTreeItemImpl(expectedContextValues);
            if (pickedItem) {
                const child: AzExtTreeItem | undefined = children.find((ti: AzExtTreeItem) => ti.fullId === pickedItem.fullId);
                if (child) {
                    return child;
                }
            }
        }

        const options: types.IAzureQuickPickOptions = {
            placeHolder: localize('selectTreeItem', 'Select {0}', this.childTypeLabel)
        };

        let getTreeItem: GetTreeItemFunction;

        try {
            getTreeItem = (await ext.ui.showQuickPick(this.getQuickPicks(expectedContextValues), options)).data;
        } catch (error) {
            // We want the loading thing to show for `showQuickPick` but we also need to support auto-select if there's only one pick
            // hence throwing an error instead of just awaiting `getQuickPicks`
            if (error instanceof AutoSelectError) {
                getTreeItem = error.data;
            } else {
                throw error;
            }
        }

        return await getTreeItem();
    }

    public addChildToCache(childToAdd: AzExtTreeItem): void {
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

    public removeChildFromCache(childToRemove: AzExtTreeItem): void {
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

    public async createTreeItemsWithErrorHandling<TSource>(
        sourceArray: TSource[],
        invalidContextValue: string,
        createTreeItem: (source: TSource) => AzExtTreeItem | undefined | Promise<AzExtTreeItem | undefined>,
        getLabelOnError: (source: TSource) => string | undefined | Promise<string | undefined>): Promise<AzExtTreeItem[]> {

        const treeItems: AzExtTreeItem[] = [];
        // tslint:disable-next-line:no-any
        let unknownError: any;
        await Promise.all(sourceArray.map(async (source: TSource) => {
            try {
                const item: AzExtTreeItem | undefined = await createTreeItem(source);
                if (item) {
                    treeItems.push(item);
                }
            } catch (error) {
                let name: string | undefined;
                try {
                    name = await getLabelOnError(source);
                } catch {
                    // ignore
                }

                if (name) {
                    treeItems.push(new InvalidTreeItem(this, name, error, invalidContextValue));
                } else if (error && !unknownError) {
                    unknownError = error;
                }
            }
        }));

        if (unknownError) {
            // Display a generic error if there are any unknown items. Only the first error will be displayed
            const message: string = localize('cantShowItems', 'Some items could not be displayed');
            treeItems.push(new InvalidTreeItem(this, message, unknownError, invalidContextValue, ''));
        }

        return treeItems;
    }

    private async loadMoreChildrenInternal(): Promise<void> {
        if (this._clearCache) {
            // Just in case implementers of `loadMoreChildrenImpl` re-use the same child node, we want to clear those caches as well
            for (const child of this._cachedChildren) {
                if (isAzExtParentTreeItem(child)) {
                    (<AzExtParentTreeItem>child).clearCache();
                }
            }
            this._cachedChildren = [];
        }

        const newTreeItems: AzExtTreeItem[] = await this.loadMoreChildrenImpl(this._clearCache);
        this._cachedChildren = this._cachedChildren.concat(newTreeItems).sort(this.compareChildrenImpl);
        this._clearCache = false;
    }

    private async getQuickPicks(expectedContextValues: (string | RegExp)[]): Promise<types.IAzureQuickPickItem<GetTreeItemFunction>[]> {
        let children: AzExtTreeItem[] = await this.getCachedChildren();
        children = children.filter((ti: AzExtTreeItem) => ti.includeInTreePicker(expectedContextValues));

        const picks: types.IAzureQuickPickItem<GetTreeItemFunction>[] = children.map((ti: AzExtTreeItem) => {
            if (ti instanceof GenericTreeItem) {
                return {
                    label: ti.label,
                    description: ti.description,
                    id: ti.fullId,
                    data: async (): Promise<AzExtTreeItem> => {
                        if (!ti.commandId) {
                            throw new Error(localize('noCommand', 'Failed to find commandId on generic tree item.'));
                        } else {
                            await commands.executeCommand(ti.commandId);
                            await this.refresh();
                            return this;
                        }
                    }
                };
            } else {
                return {
                    label: ti.label,
                    description: ti.description,
                    id: ti.fullId,
                    data: async (): Promise<AzExtTreeItem> => await Promise.resolve(ti)
                };
            }
        });

        if (this.createChildImpl && this.childTypeLabel) {
            picks.unshift({
                label: localize('treePickerCreateNew', '$(plus) Create New {0}', this.childTypeLabel),
                description: '',
                data: async (): Promise<AzExtTreeItem> => await this.createChild<AzExtTreeItem>()
            });
        }

        if (this.hasMoreChildrenImpl()) {
            picks.push({
                label: `$(sync) ${loadMoreLabel}`,
                description: '',
                data: async (): Promise<AzExtTreeItem> => {
                    await this.loadMoreChildren();
                    this.treeDataProvider.refreshUIOnly(this);
                    return this;
                }
            });
        }

        if (picks.length === 0) {
            throw new Error(localize('noMatching', 'No matching resources found.'));
        } else if (picks.length === 1 && this.autoSelectInTreeItemPicker) {
            throw new AutoSelectError(picks[0].data);
        }

        return picks;
    }
}

type GetTreeItemFunction = () => Promise<AzExtTreeItem>;

class InvalidTreeItem extends AzExtParentTreeItem {
    public readonly contextValue: string;
    public readonly label: string;
    public readonly description: string;

    // tslint:disable-next-line:no-any
    private _error: any;

    // tslint:disable-next-line:no-any
    constructor(parent: AzExtParentTreeItem, label: string, error: any, contextValue: string, description: string = localize('invalid', 'Invalid')) {
        super(parent);
        this.label = label;
        this._error = error;
        this.contextValue = contextValue;
        this.description = description;
    }

    public get iconPath(): string {
        return path.join(__filename, '..', '..', '..', '..', 'resources', 'warning.svg');
    }

    public async loadMoreChildrenImpl(): Promise<AzExtTreeItem[]> {
        throw this._error;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public isAncestorOfImpl(): boolean {
        // never display invalid items in tree picker
        return false;
    }
}

class AutoSelectError extends Error {
    public readonly data: GetTreeItemFunction;
    constructor(data: GetTreeItemFunction) {
        super();
        this.data = data;
    }
}
