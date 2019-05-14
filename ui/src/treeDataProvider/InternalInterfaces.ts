/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'vscode';
import * as types from '../../index';
import { AzExtTreeItem } from './AzExtTreeItem';

// Interfaces for methods on the tree that aren't exposed outside of this package
// We can't reference the classes directly because it would result in circular dependencies

export interface IAzExtParentTreeItemInternal extends types.AzExtParentTreeItem, AzExtTreeItem {
    _isAzExtParentTreeItem: boolean;
    parent: IAzExtParentTreeItemInternal | undefined;
    treeDataProvider: IAzExtTreeDataProviderInternal;
    removeChildFromCache(node: AzExtTreeItem): void;
    loadMoreChildren(): Promise<void>;
}

export interface IAzExtTreeDataProviderInternal extends types.AzExtTreeDataProvider {
    _onTreeItemCreateEmitter: EventEmitter<AzExtTreeItem>;
    refreshUIOnly(treeItem: AzExtTreeItem | undefined): void;
}

/**
 * Using instanceof AzExtParentTreeItem causes issues whenever packages are linked for dev testing. Instead, check _isAzExtParentTreeItem
 */
export function isAzExtParentTreeItem(item: {}): boolean {
    return !!(<IAzExtParentTreeItemInternal>item)._isAzExtParentTreeItem;
}
