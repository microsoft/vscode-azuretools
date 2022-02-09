/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ServiceClient } from '@azure/ms-rest-js';
import { IActionContext, ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import { ParsedSite } from '../SiteClient';
import { gitHubBranchData, gitHubOrgData, gitHubRepoData } from './connectToGitHub';

export interface IConnectToGitHubWizardContext extends IActionContext, ISubscriptionContext {
    orgData?: gitHubOrgData;
    repoData?: gitHubRepoData;
    branchData?: gitHubBranchData;
    site?: ParsedSite;
    gitHubClient?: ServiceClient;
}
