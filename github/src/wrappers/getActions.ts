/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import type { GitHubContext } from "../GitHubContext";
import { createOctokitClient } from "../createOctokitClient";

export type ActionsListWorkflowRuns = RestEndpointMethodTypes["actions"]["listWorkflowRunsForRepo"]["response"]["data"];
export type ActionWorkflowRuns = ActionsListWorkflowRuns["workflow_runs"][number];
export type GetActionsListWorkflowRunsParams = RestEndpointMethodTypes["actions"]["listWorkflowRunsForRepo"]["parameters"];

export async function getActions(context: GitHubContext, params?: GetActionsListWorkflowRunsParams): Promise<ActionsListWorkflowRuns> {
    const client: Octokit = await createOctokitClient(context);
    return (await client.actions.listWorkflowRunsForRepo(params)).data;
}
