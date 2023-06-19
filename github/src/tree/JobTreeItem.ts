/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { TreeElementBase } from "@microsoft/vscode-azext-utils";
import type { ViewPropertiesModel } from "@microsoft/vscode-azureresources-api";
import { TreeItem, TreeItemCollapsibleState } from "vscode";
import { getActionBasedIconPath, getJobBasedDescription } from "../utils/actionUtils";
import { Job } from "../wrappers/getJobs";
import { StepTreeItem } from "./StepTreeItem";

export class JobTreeItem implements TreeElementBase {
    static contextValueSuffix: string = 'Job';

    constructor(
        readonly parentResourceId: string,
        readonly contextValueExtensionPrefix: string,
        readonly job: Job) { }

    id: string = `${this.parentResourceId}/jobs/${this.job.id}`;
    label: string = this.job.name || this.id;

    contextValue: string = `${this.contextValueExtensionPrefix}${JobTreeItem.contextValueSuffix}`;

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
            contextValue: this.contextValue,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
        };
    }

    async getChildren(): Promise<TreeElementBase[]> {
        return this.job.steps?.map((step) => new StepTreeItem(this.id, this.contextValueExtensionPrefix, step)) ?? [];
    }
}
