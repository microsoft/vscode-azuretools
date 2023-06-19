/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import type { GitHubContext } from "../GitHubContext";
import { createOctokitClient } from "../createOctokitClient";

export type AuthenticatedUser = RestEndpointMethodTypes["users"]["getAuthenticated"]["response"]["data"];

export async function getAuthenticatedUser(context: GitHubContext): Promise<AuthenticatedUser> {
    const client: Octokit = await createOctokitClient(context);
    return (await client.users.getAuthenticated()).data;
}
