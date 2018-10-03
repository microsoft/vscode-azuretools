/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'vscode';
import { AzureParentTreeItem, AzureTreeDataProvider, ISubscriptionRoot } from '../../index';
import { AzureTreeItem } from './AzureTreeItem';

// Interfaces for methods on the tree that aren't exposed outside of this package
// We can't reference the classes directly because it would result in circular dependencies

export interface IAzureParentTreeItemInternal<TRoot = ISubscriptionRoot> extends AzureParentTreeItem<TRoot>, AzureTreeItem<TRoot> {
    parent: IAzureParentTreeItemInternal<TRoot> | undefined;
    treeDataProvider: IAzureTreeDataProviderInternal<TRoot>;
    removeChildFromCache(node: AzureTreeItem<TRoot>): Promise<void>;
    loadMoreChildren(): Promise<void>;
}

export interface IAzureTreeDataProviderInternal<TRoot = ISubscriptionRoot> extends AzureTreeDataProvider<TRoot> {
    _onTreeItemCreateEmitter: EventEmitter<AzureTreeItem<TRoot>>;
}
