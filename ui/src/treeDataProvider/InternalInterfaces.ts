/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'vscode';
import { AzExtParentTreeItem, AzExtTreeDataProvider, ISubscriptionRoot } from '../../index';
import { AzExtTreeItem } from './AzExtTreeItem';

// Interfaces for methods on the tree that aren't exposed outside of this package
// We can't reference the classes directly because it would result in circular dependencies

export interface IAzExtParentTreeItemInternal<TRoot = ISubscriptionRoot> extends AzExtParentTreeItem<TRoot>, AzExtTreeItem<TRoot> {
    parent: IAzExtParentTreeItemInternal<TRoot> | undefined;
    treeDataProvider: IAzExtTreeDataProviderInternal<TRoot>;
    removeChildFromCache(node: AzExtTreeItem<TRoot>): void;
    loadMoreChildren(): Promise<void>;
}

export interface IAzExtTreeDataProviderInternal<TRoot = ISubscriptionRoot> extends AzExtTreeDataProvider<TRoot> {
    _onTreeItemCreateEmitter: EventEmitter<AzExtTreeItem<TRoot>>;
    refreshUIOnly(treeItem: AzExtTreeItem<TRoot | ISubscriptionRoot> | undefined): void;
}
