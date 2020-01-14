/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, EventEmitter, TreeItem } from 'vscode';
import * as types from '../../index';
import { callWithTelemetryAndErrorHandling } from '../callWithTelemetryAndErrorHandling';
import { NoResouceFoundError } from '../errors';
import { localize } from '../localize';
import { parseError } from '../parseError';
import { AzExtParentTreeItem } from './AzExtParentTreeItem';
import { AzExtTreeItem } from './AzExtTreeItem';
import { GenericTreeItem } from './GenericTreeItem';
import { getThemedIconPath } from './IconPath';
import { IAzExtTreeDataProviderInternal, isAzExtParentTreeItem } from './InternalInterfaces';
import { loadMoreLabel } from './treeConstants';

export class AzExtTreeDataProvider implements IAzExtTreeDataProviderInternal, types.AzExtTreeDataProvider {
    public _onTreeItemCreateEmitter: EventEmitter<AzExtTreeItem> = new EventEmitter<AzExtTreeItem>();
    private _onDidChangeTreeDataEmitter: EventEmitter<AzExtTreeItem> = new EventEmitter<AzExtTreeItem>();

    private readonly _loadMoreCommandId: string;
    private readonly _rootTreeItem: AzExtParentTreeItem;

    constructor(rootTreeItem: AzExtParentTreeItem, loadMoreCommandId: string) {
        this._loadMoreCommandId = loadMoreCommandId;
        this._rootTreeItem = rootTreeItem;
        rootTreeItem.treeDataProvider = <IAzExtTreeDataProviderInternal>this;
    }

    public get onDidChangeTreeData(): Event<AzExtTreeItem> {
        return this._onDidChangeTreeDataEmitter.event;
    }

    public get onTreeItemCreate(): Event<AzExtTreeItem> {
        return this._onTreeItemCreateEmitter.event;
    }

    public getTreeItem(treeItem: AzExtTreeItem): TreeItem {
        return {
            label: treeItem.effectiveLabel,
            id: treeItem.fullId,
            collapsibleState: treeItem.collapsibleState,
            contextValue: treeItem.contextValue,
            iconPath: treeItem.effectiveIconPath,
            command: treeItem.commandId ? {
                command: treeItem.commandId,
                title: '',
                // tslint:disable-next-line: strict-boolean-expressions
                arguments: treeItem.commandArgs || [treeItem]
            } : undefined
        };
    }

    public async getChildren(treeItem?: AzExtParentTreeItem): Promise<AzExtTreeItem[]> {
        try {
            return <AzExtTreeItem[]>await callWithTelemetryAndErrorHandling('AzureTreeDataProvider.getChildren', async (context: types.IActionContext) => {
                context.errorHandling.suppressDisplay = true;
                context.errorHandling.rethrow = true;
                let result: AzExtTreeItem[];

                if (!treeItem) {
                    context.telemetry.properties.isActivationEvent = 'true';
                    treeItem = this._rootTreeItem;
                }

                context.telemetry.properties.contextValue = treeItem.contextValue;

                const cachedChildren: AzExtTreeItem[] = await treeItem.getCachedChildren(context);
                const hasMoreChildren: boolean = treeItem.hasMoreChildrenImpl();
                context.telemetry.properties.hasMoreChildren = String(hasMoreChildren);

                result = treeItem.creatingTreeItems.concat(cachedChildren);
                if (hasMoreChildren && !treeItem._isLoadingMore) {
                    const loadMoreTI: GenericTreeItem = new GenericTreeItem(treeItem, {
                        label: loadMoreLabel,
                        iconPath: getThemedIconPath('refresh'),
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
            return [new GenericTreeItem(treeItem, {
                label: localize('errorTreeItem', 'Error: {0}', parseError(error).message),
                contextValue: 'azureextensionui.error'
            })];
        }
    }

    public async refresh(treeItem?: AzExtTreeItem): Promise<void> {
        // tslint:disable-next-line: strict-boolean-expressions
        treeItem = treeItem || this._rootTreeItem;

        if (treeItem.refreshImpl) {
            await treeItem.refreshImpl();
        }

        if (isAzExtParentTreeItem(treeItem)) {
            (<AzExtParentTreeItem>treeItem).clearCache();
        }

        this.refreshUIOnly(treeItem);
    }

    public refreshUIOnly(_treeItem: AzExtTreeItem | undefined): void {
        // Pass undefined as temporary workaround for https://github.com/microsoft/vscode/issues/71698
        this._onDidChangeTreeDataEmitter.fire(undefined);
        // this._onDidChangeTreeDataEmitter.fire(treeItem === this._rootTreeItem ? undefined : treeItem);
    }

    public async loadMore(treeItem: AzExtParentTreeItem, context: types.IActionContext): Promise<void> {
        treeItem._isLoadingMore = true;
        try {
            this.refreshUIOnly(treeItem);
            await treeItem.loadMoreChildren(context);
        } finally {
            treeItem._isLoadingMore = false;
            this.refreshUIOnly(treeItem);
        }
    }

    public async showTreeItemPicker<T extends types.AzExtTreeItem>(expectedContextValues: string | (string | RegExp)[] | RegExp, context: types.ITreeItemPickerContext & { canPickMany: true }, startingTreeItem?: AzExtTreeItem): Promise<T[]>;
    public async showTreeItemPicker<T extends types.AzExtTreeItem>(expectedContextValues: string | (string | RegExp)[] | RegExp, context: types.ITreeItemPickerContext, startingTreeItem?: AzExtTreeItem): Promise<T>;
    public async showTreeItemPicker<T extends types.AzExtTreeItem>(expectedContextValues: string | (string | RegExp)[] | RegExp, context: types.ITreeItemPickerContext, startingTreeItem?: AzExtTreeItem): Promise<T | T[]> {
        if (!Array.isArray(expectedContextValues)) {
            expectedContextValues = [expectedContextValues];
        }

        // tslint:disable-next-line:strict-boolean-expressions
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
                throw new NoResouceFoundError();
            }
        }

        return <T><unknown>treeItem;
    }

    public async findTreeItem<T extends types.AzExtTreeItem>(fullId: string, context: types.IActionContext): Promise<T | undefined> {
        let treeItems: AzExtTreeItem[] = await this.getChildren();
        let foundAncestor: boolean;

        do {
            foundAncestor = false;

            for (const treeItem of treeItems) {
                if (treeItem.fullId === fullId) {
                    return <T><unknown>treeItem;
                } else if (fullId.startsWith(`${treeItem.fullId}/`) && isAzExtParentTreeItem(treeItem)) {
                    // Append '/' to 'treeItem.fullId' when checking 'startsWith' to ensure its actually an ancestor, rather than a treeItem at the same level that _happens_ to start with the same id
                    // For example, two databases named 'test' and 'test1' as described in this issue: https://github.com/Microsoft/vscode-cosmosdb/issues/488
                    treeItems = await (<AzExtParentTreeItem>treeItem).getCachedChildren(context);
                    foundAncestor = true;
                    break;
                }
            }
        } while (foundAncestor);

        return undefined;
    }

    public async getParent(treeItem: AzExtTreeItem): Promise<AzExtTreeItem | undefined> {
        return treeItem.parent === this._rootTreeItem ? undefined : treeItem.parent;
    }
}
