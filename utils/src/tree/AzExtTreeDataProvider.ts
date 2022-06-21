/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, Disposable, Event, EventEmitter, ThemeIcon, TreeItem, TreeView } from 'vscode';
import * as types from '../../index';
import { callWithTelemetryAndErrorHandling } from '../callWithTelemetryAndErrorHandling';
import { NoResourceFoundError, UserCancelledError } from '../errors';
import { localize } from '../localize';
import { parseError } from '../parseError';
import { addTreeItemValuesToMask } from './addTreeItemValuesToMask';
import { AzExtParentTreeItem, InvalidTreeItem } from './AzExtParentTreeItem';
import { AzExtTreeItem } from './AzExtTreeItem';
import { CollapsibleStateTracker } from './CollapsibleStateTracker';
import { GenericTreeItem } from './GenericTreeItem';
import { IAzExtTreeDataProviderInternal, isAzExtParentTreeItem } from './InternalInterfaces';
import { runWithLoadingNotification } from './runWithLoadingNotification';
import { loadMoreLabel } from './treeConstants';

export class AzExtTreeDataProvider implements IAzExtTreeDataProviderInternal, types.AzExtTreeDataProvider {
    public _onTreeItemCreateEmitter: EventEmitter<AzExtTreeItem> = new EventEmitter<AzExtTreeItem>();
    private _onDidChangeTreeDataEmitter: EventEmitter<AzExtTreeItem | undefined> = new EventEmitter<AzExtTreeItem | undefined>();
    private _collapsibleStateTracker: CollapsibleStateTracker | undefined;

    private readonly _loadMoreCommandId: string;
    private readonly _rootTreeItem: AzExtParentTreeItem;
    private readonly _findTreeItemTasks: Map<string, Promise<types.AzExtTreeItem | undefined>> = new Map<string, Promise<types.AzExtTreeItem | undefined>>();

    constructor(rootTreeItem: AzExtParentTreeItem, loadMoreCommandId: string) {
        this._loadMoreCommandId = loadMoreCommandId;
        this._rootTreeItem = rootTreeItem;
        rootTreeItem.treeDataProvider = <IAzExtTreeDataProviderInternal>this;
    }

    public get onDidChangeTreeData(): Event<AzExtTreeItem | undefined> {
        return this._onDidChangeTreeDataEmitter.event;
    }

    public get onTreeItemCreate(): Event<AzExtTreeItem> {
        return this._onTreeItemCreateEmitter.event;
    }

    public get onDidExpandOrRefreshExpandedTreeItem(): Event<AzExtTreeItem> {
        if (!this.collapsibleStateTracker) {
            throw new Error('To use the `onDidExpandOrRefreshExpandedTreeItem`, first call `trackTreeItemCollapsibleState`.');
        }

        return this.collapsibleStateTracker.onDidExpandOrRefreshExpandedEmitter.event;
    }

    public get collapsibleStateTracker(): CollapsibleStateTracker | undefined {
        return this._collapsibleStateTracker;
    }

    public trackTreeItemCollapsibleState(treeView: TreeView<AzExtTreeItem>): Disposable {
        return (this._collapsibleStateTracker = new CollapsibleStateTracker(treeView));
    }

    public getTreeItem(treeItem: AzExtTreeItem): TreeItem {
        return {
            label: treeItem.label,
            description: treeItem.effectiveDescription,
            id: treeItem.effectiveId,
            collapsibleState: treeItem.collapsibleState,
            contextValue: treeItem.contextValue,
            iconPath: treeItem.effectiveIconPath,
            command: treeItem.commandId ? {
                command: treeItem.commandId,
                title: '',
                arguments: treeItem.commandArgs || [treeItem]
            } : undefined,
            tooltip: treeItem.resolveTooltip ? undefined : treeItem.tooltip // If `resolveTooltip` is defined, return undefined here, so that `resolveTreeItem` and `resolveTooltip` get used
        };
    }

    public async resolveTreeItem(ti: TreeItem, treeItem: AzExtTreeItem): Promise<TreeItem> {
        if (treeItem.resolveTooltip) {
            ti.tooltip = await treeItem.resolveTooltip();
        }

        return ti;
    }

    public async getChildren(arg?: AzExtParentTreeItem): Promise<AzExtTreeItem[]> {
        console.log('Getting children of ' + (arg ? arg.label : 'root'));
        try {
            return <AzExtTreeItem[]>await callWithTelemetryAndErrorHandling('AzureTreeDataProvider.getChildren', async (context: types.IActionContext) => {
                context.errorHandling.suppressDisplay = true;
                context.errorHandling.rethrow = true;
                context.errorHandling.forceIncludeInReportIssueCommand = true;

                let treeItem: AzExtParentTreeItem;
                if (arg) {
                    treeItem = arg;
                } else {
                    context.telemetry.properties.isActivationEvent = 'true';
                    treeItem = this._rootTreeItem;
                }
                addTreeItemValuesToMask(context, treeItem, 'getChildren');

                context.telemetry.properties.contextValue = treeItem.contextValue;

                treeItem.clearCache();
                const children: AzExtTreeItem[] = [...treeItem.creatingTreeItems, ...await treeItem.getCachedChildren(context)];
                const hasMoreChildren: boolean = treeItem.hasMoreChildrenImpl();
                context.telemetry.properties.hasMoreChildren = String(hasMoreChildren);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const resultMap: Map<string, AzExtTreeItem> = new Map();
                const duplicateChildren: AzExtTreeItem[] = [];
                for (const child of children) {
                    this.isDuplicateChild(child, resultMap) ? duplicateChildren.push(child) : resultMap.set(child.fullIdWithContext || child.fullId, child);
                }

                const result: AzExtTreeItem[] = Array.from(resultMap.values());
                result.push(...duplicateChildren.map(c => {
                    const message: string = localize('elementWithId', 'An element with the following id already exists: {0}', c.fullId);
                    return new InvalidTreeItem(treeItem, new Error(message), { contextValue: 'azureextensionui.duplicate', label: c.label });
                }));

                if (hasMoreChildren && !treeItem.isLoadingMore) {
                    const loadMoreTI: GenericTreeItem = new GenericTreeItem(treeItem, {
                        label: loadMoreLabel,
                        iconPath: new ThemeIcon('refresh'),
                        contextValue: 'azureextensionui.loadMore',
                        commandId: this._loadMoreCommandId
                    });
                    loadMoreTI.commandArgs = [treeItem];
                    result.push(loadMoreTI);
                }

                context.telemetry.measurements.childCount = result.length;
                return result;
            });
        } catch (error) {
            return [new GenericTreeItem(arg, {
                label: localize('errorTreeItem', 'Error: {0}', parseError(error).message),
                contextValue: 'azureextensionui.error'
            })];
        }
    }

    public async refresh(context: types.IActionContext, treeItem?: AzExtTreeItem): Promise<void> {
        console.log("Refreshing " + (treeItem ? treeItem.label : 'root'));

        treeItem ||= this._rootTreeItem;

        if (treeItem.refreshImpl && !treeItem.hasBeenDeleted) {
            await treeItem.refreshImpl(context);
        }

        if (isAzExtParentTreeItem(treeItem)) {
            (<AzExtParentTreeItem>treeItem).clearCache();
        }

        this.refreshUIOnly(treeItem);
    }

    public refreshUIOnly(_treeItem: AzExtTreeItem | undefined): void {
        console.log("Refreshing UI only " + (_treeItem ? _treeItem.label : 'root'));
        this._onDidChangeTreeDataEmitter.fire(undefined);
    }

    public async loadMore(treeItem: AzExtParentTreeItem, context: types.IActionContext): Promise<void> {
        treeItem.isLoadingMore = true;
        try {
            this.refreshUIOnly(treeItem);
            await treeItem.loadMoreChildren(context);
        } finally {
            treeItem.isLoadingMore = false;
            this.refreshUIOnly(treeItem);
        }
    }

    public async showTreeItemPicker<T extends types.AzExtTreeItem>(expectedContextValues: string | (string | RegExp)[] | RegExp, context: types.ITreeItemPickerContext & { canPickMany: true }, startingTreeItem?: AzExtTreeItem): Promise<T[]>;
    public async showTreeItemPicker<T extends types.AzExtTreeItem>(expectedContextValues: string | (string | RegExp)[] | RegExp, context: types.ITreeItemPickerContext, startingTreeItem?: AzExtTreeItem): Promise<T>;
    public async showTreeItemPicker<T extends types.AzExtTreeItem>(expectedContextValues: string | (string | RegExp)[] | RegExp, context: types.ITreeItemPickerContext, startingTreeItem?: AzExtTreeItem): Promise<T | T[]> {
        if (!Array.isArray(expectedContextValues)) {
            expectedContextValues = [expectedContextValues];
        }

        let treeItem: AzExtTreeItem = startingTreeItem || this._rootTreeItem;

        while (!treeItem.matchesContextValue(expectedContextValues)) {
            if (isAzExtParentTreeItem(treeItem)) {
                const pickedItems: AzExtTreeItem | AzExtTreeItem[] = await (<AzExtParentTreeItem>treeItem).pickChildTreeItem(expectedContextValues, context);
                if (Array.isArray(pickedItems)) {
                    // canPickMany is only supported at the last stage of the picker, so automatically return if this is an array
                    return <T[]><unknown>pickedItems;
                } else {
                    treeItem = pickedItems;
                }
            } else {
                throw new NoResourceFoundError(context);
            }
        }

        addTreeItemValuesToMask(context, treeItem, 'treeItemPicker');
        return <T><unknown>treeItem;
    }

    public async getParent(treeItem: AzExtTreeItem): Promise<AzExtTreeItem | undefined> {
        return treeItem.parent === this._rootTreeItem ? undefined : treeItem.parent;
    }

    public async findTreeItem<T extends types.AzExtTreeItem>(fullId: string, context: types.IFindTreeItemContext): Promise<T | undefined> {
        let result: types.AzExtTreeItem | undefined;

        const existingTask: Promise<types.AzExtTreeItem | undefined> | undefined = this._findTreeItemTasks.get(fullId);
        if (existingTask) {
            result = await existingTask;
        } else {
            const newTask: Promise<types.AzExtTreeItem | undefined> = context.loadAll ?
                runWithLoadingNotification(context, cancellationToken => this.findTreeItemInternal(fullId, context, cancellationToken)) :
                this.findTreeItemInternal(fullId, context);
            this._findTreeItemTasks.set(fullId, newTask);
            try {
                result = await newTask;
            } finally {
                this._findTreeItemTasks.delete(fullId);
            }
        }

        if (result) {
            addTreeItemValuesToMask(context, result, 'findTreeItem');
        }
        return <T><unknown>result;
    }

    /**
     * Wrapped by `findTreeItem` to ensure only one find is happening per `fullId` at a time
     */
    private async findTreeItemInternal(fullId: string, context: types.IFindTreeItemContext, cancellationToken?: CancellationToken): Promise<types.AzExtTreeItem | undefined> {
        let treeItem: AzExtParentTreeItem = this._rootTreeItem;

        // eslint-disable-next-line no-constant-condition
        outerLoop: while (true) {
            if (cancellationToken?.isCancellationRequested) {
                throw new UserCancelledError('findTreeItem');
            }

            const children: AzExtTreeItem[] = await treeItem.getCachedChildren(context);
            for (const child of children) {
                if (child.fullId === fullId) {
                    return child;
                } else if (isAncestor(child, fullId)) {
                    treeItem = <AzExtParentTreeItem>child;
                    continue outerLoop;
                }
            }

            if (context.loadAll && treeItem.hasMoreChildrenImpl()) {
                await treeItem.loadMoreChildren(context);
            } else {
                return undefined;
            }
        }
    }

    private isDuplicateChild(child: AzExtTreeItem, children: Map<string, AzExtTreeItem>): boolean {
        const existingChild: AzExtTreeItem | undefined = children.get(child.fullId);
        if (existingChild) {
            if (existingChild.contextValue === child.contextValue) {
                return true;
            } else {
                const fullIdWithContext: string = `${child.fullId}-${child.contextValue}`;
                if (children.has(fullIdWithContext)) {
                    return true;
                }
                child.fullIdWithContext = fullIdWithContext;
            }
        }

        return false;
    }
}

function isAncestor(treeItem: AzExtTreeItem, fullId: string): boolean {
    // Append '/' to 'treeItem.fullId' when checking 'startsWith' to ensure its actually an ancestor, rather than a treeItem at the same level that _happens_ to start with the same id
    // For example, two databases named 'test' and 'test1' as described in this issue: https://github.com/Microsoft/vscode-cosmosdb/issues/488
    return fullId.startsWith(`${treeItem.fullId}/`) && isAzExtParentTreeItem(treeItem);
}
