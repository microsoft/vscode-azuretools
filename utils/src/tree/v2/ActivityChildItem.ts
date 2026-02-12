/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ProviderResult, TreeItem } from "vscode";
import type { ActivityChildItemBase, ActivityChildItemOptions } from '../../types/activity';
import { crypto } from '../../node/crypto';

export enum ActivityChildType {
    Success = 'success',
    Fail = 'fail',
    Progress = 'progress',
    Info = 'info',
    Error = 'error',
    Command = 'command',
}

export class ActivityChildItem implements ActivityChildItemBase {
    readonly id: string;
    label: string;
    contextValue: string;
    activityType: ActivityChildType;
    description?: string;
    stepId?: string;

    constructor(readonly options: ActivityChildItemOptions) {
        this.id = options.id ?? crypto.randomUUID();
        this.label = options.label;
        this.activityType = options.activityType;
        this.contextValue = options.contextValue;
        this.description = options.description;
        this.stepId = options.stepId;

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

    getChildren?(): ProviderResult<ActivityChildItemBase[]>;
}
