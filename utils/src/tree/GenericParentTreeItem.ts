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
    iconPath?: types.TreeItemIconPath;
    initialCollapsibleState?: TreeItemCollapsibleState;
    label: string;
    suppressMaskLabel?: boolean;

    compareChildrenImpl?(item1: AzExtTreeItem, item2: AzExtTreeItem): number;
    loadMoreChildrenImpl?(clearCache: boolean, context: types.IActionContext): Promise<AzExtTreeItem[]>;
}

export class GenericParentTreeItem extends AzExtParentTreeItem implements types.GenericParentTreeItem {
    public childTypeLabel?: string;
    public contextValue: string;
    public label: string;
    public suppressMaskLabel?: boolean;

    public readonly initialCollapsibleState: TreeItemCollapsibleState;

    constructor(parent: IAzExtParentTreeItemInternal | undefined, readonly options: GenericParentTreeItemOptions) {
        super(parent);
        this.childTypeLabel = options.childTypeLabel;
        this.contextValue = options.contextValue;
        this.iconPath = options.iconPath;
        this.initialCollapsibleState = options.initialCollapsibleState === undefined ?
            TreeItemCollapsibleState.Collapsed : options.initialCollapsibleState;
        this.label = options.label;
        this.suppressMaskLabel = options.suppressMaskLabel;

        this.compareChildrenImpl = options.compareChildrenImpl ?? (() => 0);
    }

    public loadMoreChildrenImpl(clearCache: boolean, context: types.IActionContext): Promise<AzExtTreeItem[]> {
        // The abstract class requires that loadMoreChildrenImpl be immediately defined
        // So define and run here rather than trying to set the value within the constructor
        return this.options.loadMoreChildrenImpl?.(clearCache, context) ?? Promise.resolve([]);
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}
