/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import type { GitHubContext } from "../GitHubContext";
import { createOctokitClient } from "../createOctokitClient";

export type Branches = RestEndpointMethodTypes["repos"]["listBranches"]["response"]["data"];
export type GetBranchesParams = RestEndpointMethodTypes["repos"]["listBranches"]["parameters"] & { owner: string; repo: string }; // Make 'owner' and 'repo' required

export async function getBranches(context: GitHubContext, reqParams: GetBranchesParams): Promise<Branches> {
    const client: Octokit = await createOctokitClient(context);
    return (await client.repos.listBranches(reqParams)).data;
}
