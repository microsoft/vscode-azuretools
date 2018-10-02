/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { User } from 'azure-arm-website/lib/models';
import * as opn from 'opn';
import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import { DialogResponses } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { ext } from '../extensionVariables';
import { getKuduClient } from '../getKuduClient';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { nonNullProp } from '../utils/nonNull';
import { formatDeployLog } from './formatDeployLog';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function localGitDeploy(client: SiteClient, fsPath: string): Promise<void> {
    const kuduClient: KuduClient = await getKuduClient(client);
    const publishCredentials: User = await client.getWebAppPublishCredential();

    // credentials for accessing Azure Remote Repo
    const username: string = publishCredentials.publishingUserName;
    const password: string = nonNullProp(publishCredentials, 'publishingPassword');
    const remote: string = `https://${username}:${password}@${client.gitUrl}`;
    const localGit: git.SimpleGit = git(fsPath);
    try {
        const status: git.StatusResult = await localGit.status();
        if (status.files.length > 0) {
            const message: string = localize('localGitUncommit', '{0} uncommitted change(s) in local repo "{1}"', status.files.length, fsPath);
            const deployAnyway: vscode.MessageItem = { title: localize('deployAnyway', 'Deploy Anyway') };
            await ext.ui.showWarningMessage(message, { modal: true }, deployAnyway, DialogResponses.cancel);
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
            // tslint:disable-next-line:no-unsafe-any
        } else if (err.message.indexOf('error: failed to push') >= 0) {
            const forcePush: vscode.MessageItem = { title: localize('forcePush', 'Force Push') };
            const pushReject: string = localize('localGitPush', 'Push rejected due to Git history diverging.');
            await ext.ui.showWarningMessage(pushReject, forcePush, DialogResponses.cancel);
            await localGit.push(remote, 'HEAD:master', { '-f': true });
        } else {
            throw err;
        }
    }

    ext.outputChannel.appendLine(formatDeployLog(client, (localize('localGitDeploy', `Deploying Local Git repository to "${client.fullName}"...`))));
    await waitForDeploymentToComplete(client, kuduClient);
}
