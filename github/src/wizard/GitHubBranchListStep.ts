/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem, nonNullProp } from "@microsoft/vscode-azext-utils";
import { QuickPickItem, l10n } from "vscode";
import type { GitHubContext } from "../GitHubContext";
import { loadMoreQp } from "../constants";
import { Branches, GetBranchesParams, getBranches } from "../wrappers/getBranches";

export class GitHubBranchListStep extends AzureWizardPromptStep<GitHubContext> {
    private picks: IAzureQuickPickItem<string>[];

    public async prompt(context: GitHubContext): Promise<void> {
        // We always want fresh picks before prompting in case the user has pressed the back button
        this.picks = [];

        const placeHolder: string = l10n.t('Select a branch');

        let page: number = 0;
        while (!context.gitHubBranch) {
            page++;
            context.gitHubBranch = (await context.ui.showQuickPick(this.getPicks(context, page), { placeHolder })).data;
        }

        context.valuesToMask.push(context.gitHubBranch);
    }

    public shouldPrompt(context: GitHubContext): boolean {
        return !context.gitHubBranch;
    }

    private async getPicks(context: GitHubContext, page: number): Promise<IAzureQuickPickItem<string | undefined>[]> {
        const perPage: number = 50;
        const branchParams: GetBranchesParams = {
            owner: nonNullProp(context, 'gitHubRepositoryOwner'),
            repo: nonNullProp(context, 'gitHubRepository'),
            per_page: perPage,
            page
        };
        const branches: Branches = await getBranches(context, branchParams);

        this.picks.push(...branches.map((branch) => { return { label: branch.name, data: branch.name } }));

        this.picks.sort((a: QuickPickItem, b: QuickPickItem) => {
            if (a.label === 'main' || a.label === 'master') {
                return -1;
            } else if (b.label === 'main' || b.label === 'master') {
                return 1;
            } else {
                return a.label.localeCompare(b.label);
            }
        });

        const maxAvailablePicks: number = perPage * page;
        return maxAvailablePicks === this.picks.length ? [...this.picks, loadMoreQp] : this.picks;
    }
}
