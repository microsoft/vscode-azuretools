/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNullOrUndefined } from 'util';
import { commands, l10n, ThemeIcon, TreeItemCollapsibleState } from 'vscode';
import * as types from '../../index';
import { NoResourceFoundError, NotImplementedError, UserCancelledError } from '../errors';
import { randomUtils } from '../utils/randomUtils';
import { AzExtTreeItem } from './AzExtTreeItem';
import { GenericTreeItem } from './GenericTreeItem';
import { IAzExtParentTreeItemInternal } from './InternalInterfaces';
import { isAzExtParentTreeItem } from './isAzExtTreeItem';
import { runWithLoadingNotification } from './runWithLoadingNotification';
import { loadMoreLabel } from './treeConstants';

export abstract class AzExtParentTreeItem extends AzExtTreeItem implements types.AzExtParentTreeItem, IAzExtParentTreeItemInternal {
    //#region Properties implemented by base class
    public childTypeLabel?: string;
    public autoSelectInTreeItemPicker?: boolean;
    public supportsAdvancedCreation?: boolean;
    public createNewLabel?: string;
    //#endregion

    public readonly initialCollapsibleState: TreeItemCollapsibleState | undefined = TreeItemCollapsibleState.Collapsed;
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

        // Return a clone to prevent timing issues and/or unintended modifications
        return [...this._cachedChildren];
    }

    public get creatingTreeItems(): AzExtTreeItem[] {
        return this._creatingTreeItems;
    }

    //#region Methods implemented by base class
    public abstract loadMoreChildrenImpl(clearCache: boolean, context: types.IActionContext): Promise<AzExtTreeItem[]>;
    public abstract hasMoreChildrenImpl(): boolean;
    public createChildImpl?(context: types.ICreateChildImplContext): Promise<AzExtTreeItem>;
    public pickTreeItemImpl?(expectedContextValues: (string | RegExp)[], context: types.IActionContext): AzExtTreeItem | undefined | Promise<AzExtTreeItem | undefined>;
    //#endregion

    public clearCache(): void {
        this._clearCache = true;
    }

    public async createChild<T extends types.AzExtTreeItem>(context: types.IActionContext & Partial<types.ICreateChildImplContext>): Promise<T> {
        if (this.createChildImpl) {
            context.telemetry.properties.advancedCreation = String(!!context.advancedCreation);

            let creatingTreeItem: AzExtTreeItem | undefined;
            try {
                const newTreeItem: AzExtTreeItem = await this.createChildImpl(
                    Object.assign(context, {
                        showCreatingTreeItem: (label: string): void => {
                            creatingTreeItem = new GenericTreeItem(this, {
                                label: l10n.t('Creating {0}...', label),
                                contextValue: `azureextensionui.creating${label}`,
                                iconPath: new ThemeIcon('loading~spin')
                            });
                            this._creatingTreeItems.push(creatingTreeItem);
                            this.treeDataProvider.refreshUIOnly(this);
                        }
                    })
                );

                this.addChildToCache(newTreeItem);
                this.treeDataProvider._onTreeItemCreateEmitter.fire(newTreeItem);
                return <T><unknown>newTreeItem;
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
        return item1.label.localeCompare(item2.label);
    }

    public async pickChildTreeItem(expectedContextValues: (string | RegExp)[], context: types.ITreeItemPickerContext): Promise<AzExtTreeItem | AzExtTreeItem[]> {
        if (this.pickTreeItemImpl) {
            const children: AzExtTreeItem[] = await this.getCachedChildren(context);
            const pickedItem: AzExtTreeItem | undefined = await this.pickTreeItemImpl(expectedContextValues, context);
            if (pickedItem) {
                const child: AzExtTreeItem | undefined = children.find((ti: AzExtTreeItem) => ti.fullId === pickedItem.fullId);
                if (child) {
                    return child;
                }
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const placeHolder: string = l10n.t('Select {0}', this.childTypeLabel!);
        const stepName = `treeItemPicker|${this.contextValue}`;

        let getTreeItem: GetTreeItemFunction;

        try {
            getTreeItem = (await context.ui.showQuickPick(this.getQuickPicks(expectedContextValues, context), { placeHolder, stepName, ignoreFocusOut: context.ignoreFocusOut })).data;
        } catch (error) {
            // We want the loading thing to show for `showQuickPick` but we also need to support autoSelect and canPickMany based on the value of the picks
            // hence throwing an error instead of just awaiting `getQuickPicks`
            if (error instanceof AutoSelectError) {
                getTreeItem = error.data;
            } else if (error instanceof CanPickManyError) {
                const result: types.IAzureQuickPickItem<GetTreeItemFunction>[] = (await context.ui.showQuickPick(error.picks, { placeHolder, stepName, canPickMany: true }));
                return await Promise.all(result.map(async pick => await pick.data()));
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
        context.loadingMessage ||= l10n.t('Loading "{0}"...', this.label);
        await runWithLoadingNotification(context, async (cancellationToken) => {
            do {
                if (cancellationToken.isCancellationRequested) {
                    throw new UserCancelledError('loadAllChildren');
                }

                await this.loadMoreChildren(context);
            } while (this.hasMoreChildrenImpl());
        });

        // Return a clone to prevent timing issues and/or unintended modifications
        return [...this._cachedChildren];
    }

    public async createTreeItemsWithErrorHandling<TSource>(
        sourceArray: TSource[] | undefined | null,
        invalidContextValue: string,
        createTreeItem: (source: TSource) => AzExtTreeItem | undefined | Promise<AzExtTreeItem | undefined>,
        getLabelOnError: (source: TSource) => string | undefined | Promise<string | undefined>): Promise<AzExtTreeItem[]> {

        const treeItems: AzExtTreeItem[] = [];
        let lastUnknownItemError: unknown;
        sourceArray ||= [];
        await Promise.all(sourceArray.map(async (source: TSource) => {
            try {
                const item: AzExtTreeItem | undefined = await createTreeItem(source);
                if (item) {
                    // Verify at least the following properties can be accessed without an error
                    item.contextValue;
                    item.description;
                    item.label;
                    item.iconPath;
                    item.id;

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
            const label: string = l10n.t('Some items could not be displayed');
            treeItems.push(new InvalidTreeItem(this, lastUnknownItemError, {
                label,
                description: '',
                contextValue: invalidContextValue
            }));
        }

        return treeItems;
    }

    private async loadMoreChildrenInternal(context: types.IActionContext): Promise<void> {
        try {
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

            if (this.collapsibleState === TreeItemCollapsibleState.Expanded) {
                this.treeDataProvider.collapsibleStateTracker?.onDidExpandOrRefreshExpandedEmitter.fire(this);
            }

            const newTreeItems: AzExtTreeItem[] = await this.loadMoreChildrenImpl(this._clearCache, context);
            this._cachedChildren = this._cachedChildren.concat(newTreeItems).sort((ti1, ti2) => this.compareChildrenImpl(ti1, ti2));
        } finally {
            this._clearCache = false;
        }
    }

    private async getQuickPicks(expectedContextValues: (string | RegExp)[], context: types.ITreeItemPickerContext & Partial<types.ICreateChildImplContext>): Promise<types.IAzureQuickPickItem<GetTreeItemFunction>[]> {
        let children: AzExtTreeItem[] = await this.getCachedChildren(context);
        children = children.filter((ti: AzExtTreeItem) => ti.includeInTreePicker(expectedContextValues));

        let autoSelectInTreeItemPicker: boolean | undefined = this.autoSelectInTreeItemPicker;
        const picks: types.IAzureQuickPickItem<GetTreeItemFunction>[] = children.map((ti: AzExtTreeItem) => {
            if (ti instanceof GenericTreeItem) {
                // Don't auto-select a command tree item
                autoSelectInTreeItemPicker = false;
                return {
                    label: ti.label,
                    description: ti.description,
                    id: ti.fullId,
                    data: async (): Promise<AzExtTreeItem> => {
                        if (!ti.commandId) {
                            throw new Error(l10n.t('Failed to find commandId on generic tree item.'));
                        } else {
                            const commandArgs: unknown[] = ti.commandArgs || [ti];
                            await commands.executeCommand(ti.commandId, ...commandArgs);
                            await this.refresh(context);
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

        if (this.createChildImpl && this.childTypeLabel && !context.suppressCreatePick) {
            const createNewLabel: string = this.createNewLabel || l10n.t('Create new {0}...', this.childTypeLabel);

            if (this.supportsAdvancedCreation) {
                picks.unshift({
                    label: `$(plus) ${createNewLabel}`,
                    description: l10n.t('Advanced'),
                    data: async (): Promise<AzExtTreeItem> => await this.createChild<AzExtTreeItem>(Object.assign(context, { advancedCreation: true }))
                });
            }

            picks.unshift({
                label: `$(plus) ${createNewLabel}`,
                data: async (): Promise<AzExtTreeItem> => await this.createChild<AzExtTreeItem>(context)
            });
        }

        if (this.hasMoreChildrenImpl()) {
            picks.push({
                label: `$(sync) ${loadMoreLabel}`,
                description: '',
                data: async (): Promise<AzExtTreeItem> => {
                    await this.treeDataProvider.loadMore(this, context);
                    return this;
                }
            });
        }

        if (picks.length === 0) {
            throw new NoResourceFoundError(context);
        } else if (picks.length === 1 && autoSelectInTreeItemPicker) {
            throw new AutoSelectError(picks[0].data);
        } else if (context.canPickMany && children.some(c => c.matchesContextValue(expectedContextValues))) {
            // canPickMany is only supported at the last stage of the picker, so only throw this error if some of the picks match
            throw new CanPickManyError(picks);
        }

        return picks;
    }
}

type GetTreeItemFunction = () => Promise<AzExtTreeItem>;

export class InvalidTreeItem extends AzExtParentTreeItem implements types.InvalidTreeItem {
    public readonly contextValue: string;
    public readonly label: string;
    public readonly data?: unknown;

    private _error: unknown;

    constructor(parent: AzExtParentTreeItem, error: unknown, options: types.IInvalidTreeItemOptions) {
        super(parent);
        this.label = options.label;
        this._error = error;
        this.contextValue = options.contextValue;
        this.data = options.data;
        this.description = options.description !== undefined ? options.description : l10n.t('Invalid');
    }

    public get id(): string {
        // `id` doesn't really matter for invalid items, but we want to avoid duplicates since that could break the tree
        return randomUtils.getRandomHexString(16);
    }

    public get iconPath(): types.TreeItemIconPath {
        return new ThemeIcon('warning');
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

class CanPickManyError extends Error {
    public readonly picks: types.IAzureQuickPickItem<GetTreeItemFunction>[];
    constructor(picks: types.IAzureQuickPickItem<GetTreeItemFunction>[]) {
        super();
        this.picks = picks;
    }
}
