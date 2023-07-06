/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { TreeElementBase } from "@microsoft/vscode-azext-utils";
import type { ViewPropertiesModel } from "@microsoft/vscode-azureresources-api";
import { TreeItem, TreeItemCollapsibleState } from "vscode";
import { getActionBasedIconPath, getJobBasedDescription } from "../utils/actionUtils";
import { Job } from "../wrappers/getJobs";
import { StepItem } from "./StepItem";

export class JobItem implements TreeElementBase {
    static contextValueSuffix: string = 'JobItem';

    constructor(
        readonly parentResourceId: string,
        readonly extensionPrefixContextValue: string,
        readonly job: Job) { }

    id: string = `${this.parentResourceId}/jobs/${this.job.id}`;
    label: string = this.job.name || this.id;

    viewProperties: ViewPropertiesModel = {
        data: this.job,
        label: this.label,
    };

    getTreeItem(): TreeItem {
        return {
            id: this.id,
            label: this.label,
            description: getJobBasedDescription(this.job),
            iconPath: getActionBasedIconPath(this.job),
            contextValue: `${this.extensionPrefixContextValue}${JobItem.contextValueSuffix}`,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
        };
    }

    async getChildren(): Promise<TreeElementBase[]> {
        return this.job.steps?.map((step) => new StepItem(this.id, this.extensionPrefixContextValue, step)) ?? [];
    }
}
