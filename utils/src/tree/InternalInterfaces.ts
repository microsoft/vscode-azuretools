/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'vscode';
import * as types from '../../index';
import { AzExtParentTreeItem } from './AzExtParentTreeItem';
import type { AzExtTreeItem } from './AzExtTreeItem';
import { CollapsibleStateTracker } from './CollapsibleStateTracker';

// Interfaces for methods on the tree that aren't exposed outside of this package
// We can't reference the classes directly because it would result in circular dependencies

export interface IAzExtParentTreeItemInternal extends AzExtParentTreeItem {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _isAzExtParentTreeItem: boolean;
    parent: IAzExtParentTreeItemInternal | undefined;
    treeDataProvider: IAzExtTreeDataProviderInternal;
    removeChildFromCache(node: AzExtTreeItem): void;
    loadMoreChildren(context: types.IActionContext): Promise<void>;
}

export interface IAzExtTreeDataProviderInternal extends types.AzExtTreeDataProvider {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _onTreeItemCreateEmitter: EventEmitter<AzExtTreeItem>;
    refreshUIOnly(treeItem: AzExtTreeItem | undefined): void;
    readonly collapsibleStateTracker: CollapsibleStateTracker | undefined;
}
