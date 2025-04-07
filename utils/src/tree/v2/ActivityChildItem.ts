/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from "vscode";
import { TreeItemIconPath } from "../../..";
import * as types from '../../../index';

export class ActivityChildItem implements types.ActivityChildItemBase {
    readonly id: string;
    label: string;
    contextValue: string;
    description?: string;
    iconPath?: TreeItemIconPath;
    initialCollapsibleState?: TreeItemCollapsibleState;

    constructor(options: types.ActivityChildItemOptions) {
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
