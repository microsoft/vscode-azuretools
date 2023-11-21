/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from "vscode";
import * as types from '../../index';
import { AzExtParentTreeItem } from "./AzExtParentTreeItem";
import { AzExtTreeItem } from "./AzExtTreeItem";
import { IAzExtParentTreeItemInternal } from "./InternalInterfaces";

interface GenericParentTreeItemOptions {
    childTypeLabel?: string;
    contextValue: string;
    initialCollapsibleState?: TreeItemCollapsibleState;
    label: string;
    suppressMaskLabel?: boolean;

    compareChildrenImpl?(item1: AzExtTreeItem, item2: AzExtTreeItem): number;
    loadMoreChildrenImpl(clearCache: boolean, context: types.IActionContext): Promise<AzExtTreeItem[]>;
}

export class GenericParentTreeItem extends AzExtParentTreeItem implements types.GenericParentTreeItem {
    contextValue: string;
    suppressMaskLabel?: boolean;

    readonly childTypeLabel?: string;
    readonly label: string;
    readonly initialCollapsibleState: TreeItemCollapsibleState;

    constructor(parent: IAzExtParentTreeItemInternal | undefined, readonly options: GenericParentTreeItemOptions) {
        super(parent);
        this.contextValue = options.contextValue;
        this.suppressMaskLabel = options.suppressMaskLabel;
        this.childTypeLabel = options.childTypeLabel;
        this.label = options.label;
        this.initialCollapsibleState = options.initialCollapsibleState === TreeItemCollapsibleState.Expanded ?
            TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed;

        this.compareChildrenImpl = options.compareChildrenImpl ?? (() => 0);
    }

    loadMoreChildrenImpl(clearCache: boolean, context: types.IActionContext): Promise<AzExtTreeItem[]> {
        // The abstract class requires that loadMoreChildrenImpl be immediately defined before the constructor is run
        // So just call the options method directly here
        return this.options.loadMoreChildrenImpl(clearCache, context);
    }

    hasMoreChildrenImpl(): boolean {
        return false;
    }
}
