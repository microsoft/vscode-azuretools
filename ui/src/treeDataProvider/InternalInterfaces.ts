/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'vscode';
import { AzureParentTreeItem, AzureTreeDataProvider, ISubscriptionRoot } from '../../index';
import { AzureTreeItem } from './AzureNode';

// Interfaces for methods on the tree that aren't exposed outside of this package
// We can't reference the classes directly because it would result in circular dependencies

export interface IAzureParentTreeItemInternal<T = ISubscriptionRoot> extends AzureParentTreeItem<T>, AzureTreeItem<T> {
    parent: IAzureParentTreeItemInternal<T> | undefined;
    treeDataProvider: IAzureTreeDataProviderInternal<T>;
    removeChildFromCache(node: AzureTreeItem<T>): Promise<void>;
    loadMoreChildren(): Promise<void>;
}

export interface IAzureTreeDataProviderInternal<T = ISubscriptionRoot> extends AzureTreeDataProvider<T> {
    _onTreeItemCreateEmitter: EventEmitter<AzureTreeItem<T>>;
}
