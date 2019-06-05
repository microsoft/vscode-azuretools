/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { createQuickPickFromJsons, createRequestOptions, getGitHubJsonResponse, gitHubOrgData, gitHubWebResource } from './connectToGitHub';
import { IConnectToGitHubWizardContext } from './IConnectToGitHubWizardContext';

export class GitHubOrgListStep extends AzureWizardPromptStep<IConnectToGitHubWizardContext> {
    public async prompt(context: IConnectToGitHubWizardContext): Promise<void> {
        const placeHolder: string = 'Choose your organization.';
        let orgQuickPick: gitHubOrgData | undefined;

        do {
            orgQuickPick = (await ext.ui.showQuickPick(this.getOrganizations(context), { placeHolder })).data;
        } while (!orgQuickPick);

        context.orgData = orgQuickPick;
    }

    public shouldPrompt(context: IConnectToGitHubWizardContext): boolean {
        return !context.orgData;
    }

    private async getOrganizations(context: IConnectToGitHubWizardContext): Promise<IAzureQuickPickItem<gitHubOrgData | undefined>[]> {
        let requestOptions: gitHubWebResource = await createRequestOptions(context, 'https://api.github.com/user');
        let quickPickItems: IAzureQuickPickItem<gitHubOrgData>[] = createQuickPickFromJsons<gitHubOrgData>(await getGitHubJsonResponse<gitHubOrgData[]>(context, requestOptions), 'login');

        requestOptions = await createRequestOptions(context, 'https://api.github.com/user/orgs');
        quickPickItems = quickPickItems.concat(createQuickPickFromJsons<gitHubOrgData>(await getGitHubJsonResponse<gitHubOrgData[]>(context, requestOptions), 'login'));

        return quickPickItems;
    }
}
