/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { nonNullProp } from '../utils/nonNull';
import { getGitHubQuickPicksWithLoadMore, gitHubRepoData, gitHubWebResource, ICachedQuickPicks } from './connectToGitHub';
import { IConnectToGitHubWizardContext } from './IConnectToGitHubWizardContext';

export class GitHubRepoListStep extends AzureWizardPromptStep<IConnectToGitHubWizardContext> {
    public async prompt(context: IConnectToGitHubWizardContext): Promise<void> {
        const placeHolder: string = 'Choose repository';
        let repoQuickPick: gitHubRepoData | undefined;
        const picksCache: ICachedQuickPicks<gitHubRepoData> = { picks: [] };
        do {
            repoQuickPick = (await ext.ui.showQuickPick(this.getRepositories(context, picksCache), { placeHolder })).data;
        } while (!repoQuickPick);

        context.repoData = repoQuickPick;
    }

    public shouldPrompt(context: IConnectToGitHubWizardContext): boolean {
        return !context.repoData;
    }

    private async getRepositories(context: IConnectToGitHubWizardContext, picksCache: ICachedQuickPicks<gitHubRepoData>): Promise<IAzureQuickPickItem<gitHubRepoData | undefined>[]> {
        const requestOption: gitHubWebResource = nonNullProp(context, 'requestOption');
        requestOption.url = nonNullProp(context, 'orgData').repos_url;
        return await getGitHubQuickPicksWithLoadMore<gitHubRepoData>(picksCache, requestOption, 'name');
    }
}
