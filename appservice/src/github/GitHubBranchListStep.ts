/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { nonNullProp } from '../utils/nonNull';
import { createRequestOptions, getGitHubQuickPicksWithLoadMore, gitHubBranchData, gitHubWebResource, ICachedQuickPicks } from './connectToGitHub';
import { IConnectToGitHubWizardContext } from './IConnectToGitHubWizardContext';

export class GitHubBranchListStep extends AzureWizardPromptStep<IConnectToGitHubWizardContext> {
    public async prompt(context: IConnectToGitHubWizardContext): Promise<void> {
        const placeHolder: string = 'Choose branch';
        let branchQuickPick: gitHubBranchData | undefined;
        const picksCache: ICachedQuickPicks<gitHubBranchData> = { picks: [] };
        do {
            branchQuickPick = (await ext.ui.showQuickPick(this.getBranches(context, picksCache), { placeHolder })).data;
        } while (!branchQuickPick);

        context.branchData = branchQuickPick;
    }

    public shouldPrompt(context: IConnectToGitHubWizardContext): boolean {
        return !context.branchData;
    }

    private async getBranches(context: IConnectToGitHubWizardContext, picksCache: ICachedQuickPicks<gitHubBranchData>): Promise<IAzureQuickPickItem<gitHubBranchData | undefined>[]> {
        const requestOption: gitHubWebResource = await createRequestOptions(context, `${nonNullProp(context, 'repoData').url}/branches`);
        return await getGitHubQuickPicksWithLoadMore<gitHubBranchData>(context, picksCache, requestOption, 'name');
    }
}
