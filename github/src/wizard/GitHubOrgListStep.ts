/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import { l10n } from "vscode";
import type { GitHubContext } from "../GitHubContext";
import { AuthenticatedUser, getAuthenticatedUser } from "../wrappers/getAuthenticatedUser";
import { Orgs, getOrgs } from "../wrappers/getOrgs";

export class GitHubOrgListStep extends AzureWizardPromptStep<GitHubContext> {
    public async prompt(context: GitHubContext): Promise<void> {
        const placeHolder: string = l10n.t('Select an organization');
        context.gitHubOrg = (await context.ui.showQuickPick(this.getPicks(context), { placeHolder })).data;

        if (context.gitHubOrg) {
            context.valuesToMask.push(context.gitHubOrg);
        }
    }

    public shouldPrompt(context: GitHubContext): boolean {
        return !context.gitHubOrg;
    }

    private async getPicks(context: GitHubContext): Promise<IAzureQuickPickItem<string | undefined>[]> {
        const user: AuthenticatedUser = await getAuthenticatedUser(context);
        const orgs: Orgs = await getOrgs(context);
        return [
            { label: user.login, data: undefined },
            ...orgs.map((org) => {
                return { label: org.login, data: org.login };
            })
        ];
    }
}
