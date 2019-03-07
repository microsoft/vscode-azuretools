/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { User } from 'azure-arm-website/lib/models';
import * as opn from 'opn';
import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import { DialogResponses, IParsedError, parseError } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { ext } from '../extensionVariables';
import { getKuduClient } from '../getKuduClient';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { nonNullProp } from '../utils/nonNull';
import { verifyNoRunFromPackageSetting } from '../verifyNoRunFromPackageSetting';
import { formatDeployLog } from './formatDeployLog';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function localGitDeploy(client: SiteClient, fsPath: string): Promise<void> {
    const kuduClient: KuduClient = await getKuduClient(client);
    const publishCredentials: User = await client.getWebAppPublishCredential();
    const remote: string = `https://${nonNullProp(publishCredentials, 'publishingUserName')}:${nonNullProp(publishCredentials, 'publishingPassword')}@${client.gitUrl}`;
    const localGit: git.SimpleGit = git(fsPath);
    const commitId: string = (await localGit.log()).latest.hash;
    const tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
    try {
        const status: git.StatusResult = await localGit.status();
        if (status.files.length > 0) {
            const message: string = localize('localGitUncommit', '{0} uncommitted change(s) in local repo "{1}"', status.files.length, fsPath);
            const deployAnyway: vscode.MessageItem = { title: localize('deployAnyway', 'Deploy Anyway') };
            await ext.ui.showWarningMessage(message, { modal: true }, deployAnyway, DialogResponses.cancel);
        }
        await verifyNoRunFromPackageSetting(client);

        // wrap two async actions in a promise because both need to run and finish simaltaneously
        await new Promise((resolve: () => void, reject: (err: IParsedError) => void): void => {
            ext.outputChannel.appendLine(formatDeployLog(client, (localize('localGitDeploy', `Deploying Local Git repository to "${client.fullName}"...`))));
            localGit.push(remote, 'HEAD:master').catch(async (error) => {
                tokenSource.cancel();
                // tslint:disable-next-line:no-unsafe-any
                const parsedError: IParsedError = parseAndRemoveCredentialsFromError(error);

                // if the push fails, check if it's due to diverging history to offer force push
                if (parsedError.message.indexOf('Updates were rejected because the remote contains work that you do') >= 0) {
                    await forcePush();
                    resolve();
                } else {
                    reject(parsedError);
                }
            });

            waitForDeploymentToComplete(client, kuduClient, commitId, tokenSource.token).then(resolve).catch((error: Error) => {
                const parsedError: IParsedError = parseAndRemoveCredentialsFromError(error);
                // waitForDeploymentToComplete throws a UserCancelledError when cancelled so that we don't mistake it as "completing"
                if (!parsedError.isUserCancelledError) {
                    reject(parsedError);
                }
            });
        });
    } catch (err) {
        // tslint:disable-next-line:no-unsafe-any
        const parsedError: IParsedError = parseAndRemoveCredentialsFromError(err);
        if (parsedError.message.indexOf('spawn git ENOENT') >= 0) {
            const installString: string = localize('Install', 'Install');
            const input: string | undefined = await vscode.window.showErrorMessage(localize('GitRequired', 'Git must be installed to use Local Git Deploy.'), installString);
            if (input === installString) {
                // tslint:disable-next-line:no-unsafe-any
                opn('https://git-scm.com/downloads');
            }
            return undefined;
        } else {
            throw parsedError;
        }
    } finally {
        tokenSource.dispose();
    }

    async function forcePush(): Promise<void> {
        const forcePushMessage: vscode.MessageItem = { title: localize('forcePush', 'Force Push') };
        const pushReject: string = localize('localGitPush', 'Push rejected due to Git history diverging.');
        if (await ext.ui.showWarningMessage(pushReject, forcePushMessage, DialogResponses.cancel) === forcePushMessage) {
            // tslint:disable-next-line:no-floating-promises
            localGit.push(remote, 'HEAD:master', { '-f': true });
            await waitForDeploymentToComplete(client, kuduClient, commitId);
        }
    }

    function parseAndRemoveCredentialsFromError(error: Error): IParsedError {
        const parsedError: IParsedError = parseError(error);
        parsedError.message.replace(nonNullProp(publishCredentials, 'publishingPassword'), '***');
        return parsedError;
    }
}
