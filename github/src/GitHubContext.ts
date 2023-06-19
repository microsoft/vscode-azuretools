/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IActionContext } from "@microsoft/vscode-azext-utils";

export interface GitHubContext extends IActionContext {
    gitHubAccessToken?: string;

    // Organization
    gitHubOrg?: string;

    // Repository
    gitHubRepository?: string;
    gitHubRepositoryOwner?: string;
    gitHubRepositoryUrl?: string;

    // Branch
    gitHubBranch?: string;
}
