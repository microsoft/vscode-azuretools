/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNullOrUndefined } from 'util';
import { TreeItemCollapsibleState } from 'vscode';
import * as types from '../../index';
import { UserCancelledError } from '../errors';
import { localize } from '../localize';
import { randomUtils } from '../utils/randomUtils';
import { AzExtTreeItem } from './AzExtTreeItem';
import { GenericTreeItem } from './GenericTreeItem';
import { getThemedIconPath } from './IconPath';
import { IAzExtParentTreeItemInternal, isAzExtParentTreeItem } from './InternalInterfaces';
import { runWithLoadingNotification } from './runWithLoadingNotification';

// tslint:disable: max-classes-per-file

export abstract class AzExtParentTreeItem extends AzExtTreeItem implements types.AzExtParentTreeItem, IAzExtParentTreeItemInternal {
    //#region Properties implemented by base class
    public childTypeLabel?: string;
    public autoSelectInTreeItemPicker?: boolean;
    public supportsAdvancedCreation?: boolean;
    public createNewLabel?: string;
    //#endregion

    public readonly collapsibleState: TreeItemCollapsibleState | undefined = TreeItemCollapsibleState.Collapsed;
    public readonly _isAzExtParentTreeItem: boolean = true;

    private _cachedChildren: AzExtTreeItem[] = [];
    private _creatingTreeItems: AzExtTreeItem[] = [];
    private _clearCache: boolean = true;
    private _loadMoreChildrenTask: Promise<void> | undefined;
    private _initChildrenTask: Promise<void> | undefined;

    public async getCachedChildren(context: types.IActionContext): Promise<AzExtTreeItem[]> {
        if (this._clearCache) {
            this._initChildrenTask = this.loadMoreChildren(context);
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
    public abstract loadMoreChildrenImpl(clearCache: boolean, context: types.IActionContext): Promise<AzExtTreeItem[]>;
    public abstract hasMoreChildrenImpl(): boolean;
    // tslint:disable-next-line:no-any
    public getCreateSubWizardImpl?<T extends types.IActionContext>(context: types.IActionContext, advancedCreation: boolean): Promise<types.IWizardOptions<T>>;
    public pickTreeItemImpl?(expectedContextValue: types.IExpectedContextValue): AzExtTreeItem | undefined | Promise<AzExtTreeItem | undefined>;
    //#endregion

    public clearCache(): void {
        this._clearCache = true;
    }

    public async withCreateProgress<T extends types.AzExtTreeItem>(newLabel: string, callback: () => Promise<T>): Promise<T> {
        let creatingTreeItem: AzExtTreeItem | undefined;
        try {
            // context.telemetry.properties.advancedCreation = String(!!context.advancedCreation);
            creatingTreeItem = new GenericTreeItem(this, {
                label: localize('creatingLabel', 'Creating {0}...', newLabel),
                contextValue: `azureextensionui.creating${newLabel}`,
                iconPath: getThemedIconPath('Loading')
            });
            this._creatingTreeItems.push(creatingTreeItem);
            this.treeDataProvider.refreshUIOnly(this);
            const newTreeItem: AzExtTreeItem = <AzExtTreeItem><unknown>await callback(); // todo cast

            this.addChildToCache(newTreeItem);
            this.treeDataProvider._onTreeItemCreateEmitter.fire(newTreeItem);
            return <T><unknown>newTreeItem;
        } finally {
            if (creatingTreeItem) {
                this._creatingTreeItems.splice(this._creatingTreeItems.indexOf(creatingTreeItem), 1);
                this.treeDataProvider.refreshUIOnly(this);
            }
        }
    }

    public compareChildrenImpl(item1: AzExtTreeItem, item2: AzExtTreeItem): number {
        return item1.effectiveLabel.localeCompare(item2.effectiveLabel);
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

    public async loadMoreChildren(context: types.IActionContext): Promise<void> {
        if (this._loadMoreChildrenTask) {
            await this._loadMoreChildrenTask;
        } else {
            this._loadMoreChildrenTask = this.loadMoreChildrenInternal(context);
            try {
                await this._loadMoreChildrenTask;
            } finally {
                this._loadMoreChildrenTask = undefined;
            }
        }
    }

    public async loadAllChildren(context: types.ILoadingTreeContext): Promise<AzExtTreeItem[]> {
        context.loadingMessage = context.loadingMessage || localize('loadingTreeItem', 'Loading "{0}"...', this.label);
        await runWithLoadingNotification(context, async (cancellationToken) => {
            do {
                if (cancellationToken.isCancellationRequested) {
                    context.telemetry.properties.cancelStep = 'loadAllChildren';
                    throw new UserCancelledError();
                }

                await this.loadMoreChildren(context);
            } while (this.hasMoreChildrenImpl());
        });

        return this._cachedChildren;
    }

    public async createTreeItemsWithErrorHandling<TSource>(
        sourceArray: TSource[] | undefined | null,
        invalidContextValue: string,
        createTreeItem: (source: TSource) => AzExtTreeItem | undefined | Promise<AzExtTreeItem | undefined>,
        getLabelOnError: (source: TSource) => string | undefined | Promise<string | undefined>): Promise<AzExtTreeItem[]> {

        const treeItems: AzExtTreeItem[] = [];
        let lastUnknownItemError: unknown;
        // tslint:disable-next-line: strict-boolean-expressions
        sourceArray = sourceArray || [];
        await Promise.all(sourceArray.map(async (source: TSource) => {
            try {
                const item: AzExtTreeItem | undefined = await createTreeItem(source);
                if (item) {
                    // Verify at least the following properties can be accessed without an error
                    // tslint:disable: no-unused-expression
                    item.contextValue;
                    item.description;
                    item.label;
                    item.iconPath;
                    item.id;
                    // tslint:enable: no-unused-expression

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
                    treeItems.push(new InvalidTreeItem(this, error, {
                        label: name,
                        contextValue: invalidContextValue,
                        data: source
                    }));
                } else if (!isNullOrUndefined(error)) {
                    lastUnknownItemError = error;
                }
            }
        }));

        if (!isNullOrUndefined(lastUnknownItemError)) {
            // Display a generic error if there are any unknown items. Only the last error will be displayed
            const label: string = localize('cantShowItems', 'Some items could not be displayed');
            treeItems.push(new InvalidTreeItem(this, lastUnknownItemError, {
                label,
                description: '',
                contextValue: invalidContextValue
            }));
        }

        return treeItems;
    }

    private async loadMoreChildrenInternal(context: types.IActionContext): Promise<void> {
        this._isLoadingMore = true;
        try {
            this.treeDataProvider.refreshUIOnly(this);

            if (this._clearCache) {
                // Just in case implementers of `loadMoreChildrenImpl` re-use the same child node, we want to clear those caches as well
                for (const child of this._cachedChildren) {
                    if (isAzExtParentTreeItem(child)) {
                        (<AzExtParentTreeItem>child).clearCache();
                    }
                }
                this._cachedChildren = [];
            } else if (!this.hasMoreChildrenImpl()) {
                // No-op since all children are already loaded
                return;
            }

            const newTreeItems: AzExtTreeItem[] = await this.loadMoreChildrenImpl(this._clearCache, context);
            this._cachedChildren = this._cachedChildren.concat(newTreeItems).sort((ti1, ti2) => this.compareChildrenImpl(ti1, ti2));
        } finally {
            this._clearCache = false;
            this._isLoadingMore = false;
            this.treeDataProvider.refreshUIOnly(this);
        }
    }
}

export class InvalidTreeItem extends AzExtParentTreeItem implements types.InvalidTreeItem {
    public readonly contextValue: types.IContextValue;
    public readonly label: string;
    public readonly description: string;
    public readonly data?: unknown;

    private _error: unknown;

    constructor(parent: AzExtParentTreeItem, error: unknown, options: types.IInvalidTreeItemOptions) {
        super(parent);
        this.label = options.label;
        this._error = error;
        this.contextValue = { id: options.contextValue };
        this.data = options.data;
        this.description = options.description !== undefined ? options.description : localize('invalid', 'Invalid');
    }

    public get id(): string {
        // `id` doesn't really matter for invalid items, but we want to avoid duplicates since that could break the tree
        return randomUtils.getRandomHexString(16);
    }

    public get iconPath(): types.TreeItemIconPath {
        return getThemedIconPath('warning');
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
