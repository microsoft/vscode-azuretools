/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { getGitHubQuickPicksWithLoadMore, gitHubBranchData, ICachedQuickPicks } from './connectToGitHub';
import { IConnectToGitHubWizardContext } from './IConnectToGitHubWizardContext';

export class GitHubBranchListStep extends AzureWizardPromptStep<IConnectToGitHubWizardContext> {
    public async prompt(context: IConnectToGitHubWizardContext): Promise<void> {
        const placeHolder: string = localize('chooseBranch', 'Choose branch');
        let branchData: gitHubBranchData | string;
        const picksCache: ICachedQuickPicks<gitHubBranchData> = { picks: [] };
        let url: string = `${nonNullProp(context, 'repoData').url}/branches`;
        // tslint:disable-next-line: no-constant-condition
        while (true) {
            branchData = (await ext.ui.showQuickPick(this.getBranchPicks(context, picksCache, url), { placeHolder })).data;
            if (typeof branchData === 'string') {
                url = branchData;
            } else {
                break;
            }
        }

        context.branchData = branchData;
    }

    public shouldPrompt(context: IConnectToGitHubWizardContext): boolean {
        return !context.branchData;
    }

    private async getBranchPicks(context: IConnectToGitHubWizardContext, picksCache: ICachedQuickPicks<gitHubBranchData>, url: string): Promise<IAzureQuickPickItem<gitHubBranchData | string>[]> {
        return await getGitHubQuickPicksWithLoadMore<gitHubBranchData>(context, picksCache, url, 'name');
    }
}
