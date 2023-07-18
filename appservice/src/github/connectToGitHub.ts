/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SiteSourceControl } from '@azure/arm-appservice';
import { GitHubBranchListStep, GitHubContext, GitHubOrgListStep, GitHubRepositoryListStep } from '@microsoft/vscode-azext-github';
import { AzureWizard, IActionContext, IParsedError, nonNullProp, parseError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ParsedSite } from '../SiteClient';
import { ext } from '../extensionVariables';
import { verifyNoRunFromPackageSetting } from '../verifyNoRunFromPackageSetting';

export type gitHubOrgData = { login: string, repos_url: string };
export type gitHubRepoData = { name: string, repos_url: string, url: string, html_url: string };
export type gitHubBranchData = { name: string };
export type gitHubLink = { prev?: string, next?: string, last?: string, first?: string };

export async function connectToGitHub(context: IActionContext, site: ParsedSite): Promise<void> {
    const title: string = vscode.l10n.t('Connect GitHub repository');

    const wizardContext: GitHubContext = {
        ...context,
    };
    const wizard: AzureWizard<GitHubContext> = new AzureWizard(wizardContext, {
        title,
        promptSteps: [
            new GitHubOrgListStep(),
            new GitHubRepositoryListStep(),
            new GitHubBranchListStep()
        ]
    });

    await wizard.prompt();

    const siteSourceControl: SiteSourceControl = {
        repoUrl: nonNullProp(wizardContext, 'gitHubRepositoryUrl'),
        branch: nonNullProp(wizardContext, 'gitHubBranch'),
        isManualIntegration: false,
        deploymentRollbackEnabled: true,
        isMercurial: false
    };

    const repoName: string = `${nonNullProp(wizardContext, 'gitHubRepositoryOwner')}/${nonNullProp(wizardContext, 'gitHubRepository')}`;

    const client = await site.createClient(context);
    try {
        const connectingToGithub: string = vscode.l10n.t('"{0}" is being connected to repo "{1}". This may take several minutes...', site.fullName, repoName);
        const connectedToGithub: string = vscode.l10n.t('Repo "{0}" is connected and deployed to "{1}".', repoName, site.fullName);
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: connectingToGithub }, async (): Promise<void> => {
            ext.outputChannel.appendLog(connectingToGithub);
            await verifyNoRunFromPackageSetting(context, site);
            await client.updateSourceControl(siteSourceControl);
            void vscode.window.showInformationMessage(connectedToGithub);
            ext.outputChannel.appendLog(connectedToGithub);
        });
    } catch (err) {
        try {
            // a resync will fix the first broken build
            // https://github.com/projectkudu/kudu/issues/2277
            await client.syncRepository();
        } catch (error) {
            const parsedError: IParsedError = parseError(error);
            // The portal returns 200, but is expecting a 204 which causes it to throw an error even after a successful sync
            if (parsedError.message.indexOf('"statusCode":200') === -1) {
                throw error;
            }
        }
    }
}
