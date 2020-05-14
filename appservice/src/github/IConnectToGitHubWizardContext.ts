/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureTreeItem, IActionContext } from 'vscode-azureextensionui';
import { ISiteClient } from '../';
import { gitHubBranchData, gitHubOrgData, gitHubRepoData } from './connectToGitHub';

export interface IConnectToGitHubWizardContext extends IActionContext {
    orgData?: gitHubOrgData;
    repoData?: gitHubRepoData;
    branchData?: gitHubBranchData;
    client?: ISiteClient;
    node?: AzureTreeItem;
}
