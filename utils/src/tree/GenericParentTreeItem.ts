/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from "vscode";
import type { IActionContext } from '../types/actionContext';
import type { TreeItemIconPath } from '../types/treeItem';
import { AzExtParentTreeItem } from "./AzExtParentTreeItem";
import { AzExtTreeItem } from "./AzExtTreeItem";
import { IAzExtParentTreeItemInternal } from "./InternalInterfaces";

export interface GenericParentTreeItemOptions {
    childTypeLabel?: string;
    contextValue: string;
    iconPath?: TreeItemIconPath;
    id?: string;
    initialCollapsibleState?: TreeItemCollapsibleState;
    label: string;
    suppressMaskLabel?: boolean;

    compareChildrenImpl?(item1: AzExtTreeItem, item2: AzExtTreeItem): number;
    loadMoreChildrenImpl?(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]>;
}

/**
 * A convenience class used for very basic parent tree items
 */
export class GenericParentTreeItem extends AzExtParentTreeItem {
    public childTypeLabel?: string;
    public contextValue: string;
    public label: string;
    public suppressMaskLabel?: boolean;

    public readonly initialCollapsibleState: TreeItemCollapsibleState;

    constructor(parent: IAzExtParentTreeItemInternal | undefined, readonly options: GenericParentTreeItemOptions) {
        super(parent);
        this.id = options.id;
        this.childTypeLabel = options.childTypeLabel;
        this.contextValue = options.contextValue;
        this.iconPath = options.iconPath;
        this.initialCollapsibleState = options.initialCollapsibleState ?? TreeItemCollapsibleState.Collapsed;
        this.label = options.label;
        this.suppressMaskLabel = options.suppressMaskLabel;

        this.compareChildrenImpl = options.compareChildrenImpl ?? (() => 0);
    }

    public loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        // Save and run off the saved tree item constructor options since we cannot assign the value directly during initialization
        // (Abstract class inheritance requires loadMoreChildrenImpl definition be immediately defined)
        return this.options.loadMoreChildrenImpl?.(clearCache, context) ?? Promise.resolve([]);
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}
