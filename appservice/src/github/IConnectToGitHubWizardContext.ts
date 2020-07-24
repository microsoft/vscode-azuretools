/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClient } from '@azure/ms-rest-js';
import { IActionContext, ISubscriptionContext } from 'vscode-azureextensionui';
import { SiteClient } from '../SiteClient';
import { gitHubBranchData, gitHubOrgData, gitHubRepoData } from './connectToGitHub';

export interface IConnectToGitHubWizardContext extends IActionContext, ISubscriptionContext {
    orgData?: gitHubOrgData;
    repoData?: gitHubRepoData;
    branchData?: gitHubBranchData;
    client?: SiteClient;
    gitHubClient?: ServiceClient;
}
