/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { User } from 'azure-arm-website/lib/models';
import * as opn from 'opn';
import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { DialogResponses } from '../DialogResponses';
import { getKuduClient } from '../getKuduClient';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { formatDeployLog } from './formatDeployLog';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function localGitDeploy(client: SiteClient, fsPath: string, outputChannel: vscode.OutputChannel): Promise<void> {
    const kuduClient: KuduClient = await getKuduClient(client);
    const pushReject: string = localize('localGitPush', 'Push rejected due to Git history diverging. Force push?');
    const publishCredentials: User = await client.getWebAppPublishCredential();

    // credentials for accessing Azure Remote Repo
    const username: string = publishCredentials.publishingUserName;
    const password: string = publishCredentials.publishingPassword;
    const remote: string = `https://${username}:${password}@${client.gitUrl}`;
    const localGit: git.SimpleGit = git(fsPath);
    try {
        const status: git.StatusResult = await localGit.status();
        if (status.files.length > 0) {
            const uncommit: string = localize('localGitUncommit', '{0} uncommitted change(s) in local repo "{1}"', status.files.length, fsPath);
            vscode.window.showWarningMessage(uncommit);
        }
        await localGit.push(remote, 'HEAD:master');
    } catch (err) {
        // tslint:disable-next-line:no-unsafe-any
        if (err.message.indexOf('spawn git ENOENT') >= 0) {
            const installString: string = localize('Install', 'Install');
            const input: string | undefined = await vscode.window.showErrorMessage(localize('GitRequired', 'Git must be installed to use Local Git Deploy.'), installString);
            if (input === installString) {
                // tslint:disable-next-line:no-unsafe-any
                opn('https://git-scm.com/downloads');
            }
            return undefined;
        } else if (err.message.indexOf('error: failed to push') >= 0) { // tslint:disable-line:no-unsafe-any
            const input: vscode.MessageItem | undefined = await vscode.window.showErrorMessage(pushReject, DialogResponses.yes, DialogResponses.cancel);
            if (input === DialogResponses.yes) {
                await localGit.push(remote, 'HEAD:master', { '-f': true });
            } else {
                throw new UserCancelledError();
            }
        } else {
            throw err;
        }
    }

    outputChannel.show();
    outputChannel.appendLine(formatDeployLog(client, (localize('localGitDeploy', `Deploying Local Git repository to "${client.fullName}"...`))));
    await waitForDeploymentToComplete(client, kuduClient, outputChannel);
}
