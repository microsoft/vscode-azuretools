/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Event, EventEmitter, TreeItem } from 'vscode';
import { IActionContext } from '../../index';
import * as types from '../../index';
import { callWithTelemetryAndErrorHandling } from '../callWithTelemetryAndErrorHandling';
import { localize } from '../localize';
import { parseError } from '../parseError';
import { AzExtParentTreeItem } from './AzExtParentTreeItem';
import { AzExtTreeItem } from './AzExtTreeItem';
import { GenericTreeItem } from './GenericTreeItem';
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
                arguments: [treeItem]
            } : undefined
        };
    }

    public async getChildren(treeItem?: AzExtParentTreeItem): Promise<AzExtTreeItem[]> {
        try {
            // tslint:disable:no-var-self
            const me: AzExtTreeDataProvider = this;
            return <AzExtTreeItem[]>await callWithTelemetryAndErrorHandling('AzureTreeDataProvider.getChildren', async function (this: IActionContext): Promise<AzExtTreeItem[]> {
                const actionContext: IActionContext = this;
                // tslint:enable:no-var-self
                actionContext.suppressErrorDisplay = true;
                actionContext.rethrowError = true;
                let result: AzExtTreeItem[];

                if (!treeItem) {
                    actionContext.properties.isActivationEvent = 'true';
                    treeItem = me._rootTreeItem;
                }

                actionContext.properties.contextValue = treeItem.contextValue;

                const cachedChildren: AzExtTreeItem[] = await treeItem.getCachedChildren();
                const hasMoreChildren: boolean = treeItem.hasMoreChildrenImpl();
                actionContext.properties.hasMoreChildren = String(hasMoreChildren);

                result = treeItem.creatingTreeItems.concat(cachedChildren);
                if (hasMoreChildren) {
                    result = result.concat(new GenericTreeItem(treeItem, {
                        label: loadMoreLabel,
                        iconPath: {
                            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'refresh.svg'),
                            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'refresh.svg')
                        },
                        contextValue: 'azureextensionui.loadMore',
                        commandId: me._loadMoreCommandId
                    }));
                }

                this.measurements.childCount = result.length;
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

    public refreshUIOnly(treeItem: AzExtTreeItem | undefined): void {
        this._onDidChangeTreeDataEmitter.fire(treeItem === this._rootTreeItem ? undefined : treeItem);
    }

    public async loadMore(treeItem: AzExtTreeItem): Promise<void> {
        if (treeItem.parent) {
            await treeItem.parent.loadMoreChildren();
            this.refreshUIOnly(treeItem.parent);
        }
    }

    public async showTreeItemPicker<T extends types.AzExtTreeItem>(expectedContextValues: string | (string | RegExp)[] | RegExp, startingTreeItem?: AzExtTreeItem): Promise<T> {
        if (!Array.isArray(expectedContextValues)) {
            expectedContextValues = [expectedContextValues];
        }

        // tslint:disable-next-line:strict-boolean-expressions
        let treeItem: AzExtTreeItem = startingTreeItem || this._rootTreeItem;

        while (!expectedContextValues.some((val: string | RegExp) => (val instanceof RegExp && val.test(treeItem.contextValue)) || treeItem.contextValue === val)) {
            if (isAzExtParentTreeItem(treeItem)) {
                treeItem = await (<AzExtParentTreeItem>treeItem).pickChildTreeItem(expectedContextValues);
            } else {
                throw new Error(localize('noResourcesError', 'No matching resources found.'));
            }
        }

        // tslint:disable-next-line: no-any
        return <T><any>treeItem;
    }

    public async findTreeItem<T extends types.AzExtTreeItem>(fullId: string): Promise<T | undefined> {
        let treeItems: AzExtTreeItem[] = await this.getChildren();
        let foundAncestor: boolean;

        do {
            foundAncestor = false;

            for (const treeItem of treeItems) {
                if (treeItem.fullId === fullId) {
                    // tslint:disable-next-line: no-any
                    return <T><any>treeItem;
                } else if (fullId.startsWith(`${treeItem.fullId}/`) && isAzExtParentTreeItem(treeItem)) {
                    // Append '/' to 'treeItem.fullId' when checking 'startsWith' to ensure its actually an ancestor, rather than a treeItem at the same level that _happens_ to start with the same id
                    // For example, two databases named 'test' and 'test1' as described in this issue: https://github.com/Microsoft/vscode-cosmosdb/issues/488
                    treeItems = await (<AzExtParentTreeItem>treeItem).getCachedChildren();
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
