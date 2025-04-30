/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { v4 as uuidv4 } from "uuid";
import { ProviderResult, TreeItem } from "vscode";
import * as types from '../../../index';

export enum ActivityChildType {
    Success = 'success',
    Fail = 'fail',
    Progress = 'progress',
    Info = 'info',
    Error = 'error',
    Command = 'command',
}

export class ActivityChildItem implements types.ActivityChildItemBase {
    readonly id: string;
    label: string;
    contextValue: string;
    activityType: ActivityChildType;
    description?: string;

    constructor(readonly options: types.ActivityChildItemOptions) {
        this.id = options.id ?? uuidv4();
        this.label = options.label;
        this.activityType = options.activityType;
        this.contextValue = options.contextValue;
        this.description = options.description;

        if (options.isParent) {
            this.getChildren = () => [];
        }
    }

    getTreeItem(): TreeItem | Thenable<TreeItem> {
        return {
            id: this.id,
            label: this.label,
            description: this.description,
            contextValue: this.contextValue,
            iconPath: this.options.iconPath,
            collapsibleState: this.options.initialCollapsibleState,
            tooltip: this.options.tooltip,
            command: this.options.command,
        };
    }

    getChildren?(): ProviderResult<types.ActivityChildItemBase[]>;
}
