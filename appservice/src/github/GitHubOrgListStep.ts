/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { createQuickPickFromJsons, getGitHubJsonResponse, gitHubOrgData } from './connectToGitHub';
import { IConnectToGitHubWizardContext } from './IConnectToGitHubWizardContext';

export class GitHubOrgListStep extends AzureWizardPromptStep<IConnectToGitHubWizardContext> {
    public async prompt(context: IConnectToGitHubWizardContext): Promise<void> {
        const placeHolder: string = localize('chooseOrg', 'Choose organization.');
        context.orgData = (await context.ui.showQuickPick(this.getOrganizations(context), { placeHolder })).data;
    }

    public shouldPrompt(context: IConnectToGitHubWizardContext): boolean {
        return !context.orgData;
    }

    private async getOrganizations(context: IConnectToGitHubWizardContext): Promise<IAzureQuickPickItem<gitHubOrgData | undefined>[]> {
        const [userData]: [gitHubOrgData[], string | undefined] = await getGitHubJsonResponse(context, 'https://api.github.com/user');
        let quickPickItems: IAzureQuickPickItem<gitHubOrgData>[] = createQuickPickFromJsons(userData, 'login');

        const [orgData]: [gitHubOrgData[], string | undefined] = await getGitHubJsonResponse(context, 'https://api.github.com/user/orgs');
        quickPickItems = quickPickItems.concat(createQuickPickFromJsons(orgData, 'login'));

        return quickPickItems;
    }
}
