/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ProviderResult, TreeItem } from "vscode";
import { TreeElementBase } from "../../..";

export interface ActivityItemBase extends TreeElementBase {
    contextValue?: string;
}

export type ActivityItemOptions = {
    id: string;
    contextValue: string;
};

export class ActivityItem implements ActivityItemBase {
    id: string;
    contextValue: string;

    constructor(options: ActivityItemOptions) {
        this.id = options.id;
        this.contextValue = options.contextValue;
    }

    getTreeItem(): TreeItem | Thenable<TreeItem> {
        //
    }

    getChildren(): ProviderResult<TreeElementBase[]> {
        //
    }
}
