/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from "vscode";
import { TreeElementBase, TreeItemIconPath } from "../../..";

export interface ActivityChildItemBase extends TreeElementBase {
    contextValue?: string;
    description?: string;
}

export type ActivityChildItemOptions = {
    id: string;
    label: string;
    contextValue: string;
    description?: string;
    iconPath?: TreeItemIconPath;
    initialCollapsibleState?: TreeItemCollapsibleState;
};

export class ActivityChildItem implements ActivityChildItemBase {
    readonly id: string;
    label: string;
    contextValue: string;
    description?: string;
    iconPath?: TreeItemIconPath;
    initialCollapsibleState?: TreeItemCollapsibleState;

    constructor(options: ActivityChildItemOptions) {
        this.id = options.id;
        this.label = options.label;
        this.contextValue = options.contextValue;
        this.description = options.description;
        this.iconPath = options.iconPath;
        this.initialCollapsibleState = options.initialCollapsibleState;
    }

    getTreeItem(): TreeItem | Thenable<TreeItem> {
        return {
            label: this.label,
            description: this.description,
            iconPath: this.iconPath,
            contextValue: this.contextValue,
            collapsibleState: this.initialCollapsibleState,
        }
    }
}
