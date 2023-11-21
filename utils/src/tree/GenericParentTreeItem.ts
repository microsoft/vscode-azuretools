/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from "vscode";
import * as types from '../../index';

export class GenericParentTreeItem extends types.AzExtParentTreeItem {
    contextValue: string;
    suppressMaskLabel?: boolean;

    readonly childTypeLabel?: string;
    readonly label: string;
    readonly initialCollapsibleState: TreeItemCollapsibleState;
    readonly parent: types.AzExtParentTreeItem | undefined;

    constructor(parent: types.AzExtParentTreeItem | undefined, readonly options: types.GenericParentTreeItemOptions) {
        super(parent);
        this.contextValue = options.contextValue;
        this.suppressMaskLabel = options.suppressMaskLabel;
        this.childTypeLabel = options.childTypeLabel;
        this.label = options.label;
        this.initialCollapsibleState = options.initialCollapsibleState === TreeItemCollapsibleState.Expanded ?
            TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed;

        this.compareChildrenImpl = options.compareChildrenImpl ?? (() => 0);
    }

    async loadMoreChildrenImpl(clearCache: boolean, context: types.IActionContext): Promise<types.AzExtTreeItem[]> {
        // The abstract class requires that loadMoreChildrenImpl be immediately defined before the constructor is run
        // So just call the options method directly here
        return await this.options.loadMoreChildrenImpl(clearCache, context);
    }

    hasMoreChildrenImpl(): boolean {
        return false;
    }
}
