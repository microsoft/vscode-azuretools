/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from '@microsoft/vscode-azext-utils';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { getGitHubQuickPicksWithLoadMore, gitHubRepoData, ICachedQuickPicks } from './connectToGitHub';
import { IConnectToGitHubWizardContext } from './IConnectToGitHubWizardContext';

export class GitHubRepoListStep extends AzureWizardPromptStep<IConnectToGitHubWizardContext> {
    public async prompt(context: IConnectToGitHubWizardContext): Promise<void> {
        const placeHolder: string = localize('chooseRepo', 'Choose repository');
        let repoData: gitHubRepoData | string;
        const picksCache: ICachedQuickPicks<gitHubRepoData> = { picks: [] };

        let url: string = nonNullProp(context, 'orgData').repos_url;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            repoData = (await context.ui.showQuickPick(this.getRepositories(context, picksCache, url), { placeHolder })).data;
            if (typeof repoData === 'string') {
                url = repoData;
            } else {
                break;
            }
        }

        context.repoData = repoData;
    }

    public shouldPrompt(context: IConnectToGitHubWizardContext): boolean {
        return !context.repoData;
    }

    private async getRepositories(context: IConnectToGitHubWizardContext, picksCache: ICachedQuickPicks<gitHubRepoData>, url: string): Promise<IAzureQuickPickItem<gitHubRepoData | string>[]> {
        return await getGitHubQuickPicksWithLoadMore<gitHubRepoData>(context, picksCache, url, 'name');
    }
}
