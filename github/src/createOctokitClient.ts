/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { appendExtensionUserAgent } from "@microsoft/vscode-azext-utils";
import { Octokit } from "@octokit/rest";
import type { GitHubContext } from "./GitHubContext";
import { getGitHubAccessToken } from "./utils/getGitHubAccessToken";

export async function createOctokitClient(context: GitHubContext): Promise<Octokit> {
    context.gitHubAccessToken ||= await getGitHubAccessToken();
    return new Octokit({
        userAgent: appendExtensionUserAgent(),
        auth: context.gitHubAccessToken
    });
}
