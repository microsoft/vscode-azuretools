/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IActionContext, TreeElementBase, callWithTelemetryAndErrorHandling, createContextValue, nonNullProp, nonNullValue } from "@microsoft/vscode-azext-utils";
import type { ViewPropertiesModel } from "@microsoft/vscode-azureresources-api";
import { TreeItem, TreeItemCollapsibleState } from "vscode";
import { Status, getActionBasedIconPath } from "../utils/actionUtils";
import { gitHubUrlParse } from "../utils/gitHubUrlParse";
import { ActionWorkflowRuns } from "../wrappers/getActions";
import { GetJobsParams, Job, Jobs, getJobs } from "../wrappers/getJobs";
import { JobItem } from "./JobItem";

export class ActionItem implements TreeElementBase {
    static readonly contextValueSuffix: string = 'ActionItem';
    static readonly contextValueCompleted: string = 'actionState:completed';
    static readonly contextValueInProgress: string = 'actionState:inProgress';

    constructor(
        readonly parentResourceId: string,
        readonly contextValueExtensionPrefix: string,
        readonly actionWorkflowRuns: ActionWorkflowRuns) { }

    id: string = `${this.parentResourceId}/${this.actionWorkflowRuns.id}`;
    label: string = this.actionWorkflowRuns.head_commit?.message || this.actionWorkflowRuns.head_sha;

    viewProperties: ViewPropertiesModel = {
        data: this.actionWorkflowRuns,
        label: this.label,
    }

    get contextValue(): string {
        const actionTreeItemContextValue: string = `${this.contextValueExtensionPrefix}${ActionItem.contextValueSuffix}`;
        const values: string[] = [actionTreeItemContextValue];

        if (<Status>nonNullProp(this.actionWorkflowRuns, 'status') === Status.Completed) {
            values.push(ActionItem.contextValueCompleted)
        } else {
            values.push(ActionItem.contextValueInProgress);
        }

        return createContextValue(values);
    }

    getTreeItem(): TreeItem {
        return {
            id: this.id,
            label: this.label,
            description: this.actionWorkflowRuns.event,
            iconPath: getActionBasedIconPath(this.actionWorkflowRuns),
            contextValue: this.contextValue,
            collapsibleState: TreeItemCollapsibleState.Collapsed
        };
    }

    async getChildren(): Promise<TreeElementBase[]> {
        const jobsData: Jobs | undefined = await callWithTelemetryAndErrorHandling('getActionChildren', async (context: IActionContext) => {
            const { ownerOrOrganization, repositoryName } = gitHubUrlParse(this.actionWorkflowRuns.repository.html_url);
            const getJobsParams: GetJobsParams = {
                owner: nonNullValue(ownerOrOrganization),
                repo: nonNullValue(repositoryName),
                run_id: this.actionWorkflowRuns.id
            };
            return await getJobs(context, getJobsParams);
        });

        if (jobsData?.total_count) {
            return jobsData.jobs.map((job: Job) => new JobItem(this.id, this.contextValueExtensionPrefix, job));
        } else {
            return [];
        }
    }
}
