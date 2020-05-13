/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { createRequestOptions, getGitHubQuickPicksWithLoadMore, gitHubRepoData, gitHubWebResource, ICachedQuickPicks } from './connectToGitHub';
import { IConnectToGitHubWizardContext } from './IConnectToGitHubWizardContext';

export class GitHubRepoListStep extends AzureWizardPromptStep<IConnectToGitHubWizardContext> {
    public async prompt(context: IConnectToGitHubWizardContext): Promise<void> {
        const placeHolder: string = localize('chooseRepo', 'Choose repository');
        let repoData: gitHubRepoData | undefined;
        const picksCache: ICachedQuickPicks<gitHubRepoData> = { picks: [] };
        const requestOptions: gitHubWebResource = await createRequestOptions(context, nonNullProp(context, 'orgData').repos_url);
        do {
            repoData = (await ext.ui.showQuickPick(this.getRepositories(context, picksCache, requestOptions), { placeHolder })).data;
        } while (!repoData);

        context.repoData = repoData;
    }

    public shouldPrompt(context: IConnectToGitHubWizardContext): boolean {
        return !context.repoData;
    }

    private async getRepositories(context: IConnectToGitHubWizardContext, picksCache: ICachedQuickPicks<gitHubRepoData>, requestOptions: gitHubWebResource): Promise<IAzureQuickPickItem<gitHubRepoData | undefined>[]> {
        return await getGitHubQuickPicksWithLoadMore<gitHubRepoData>(context, picksCache, requestOptions, 'name');
    }
}
