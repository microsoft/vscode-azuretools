/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { User } from 'azure-arm-website/lib/models';
import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import { callWithMaskHandling, DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { ISiteClient } from '../ISiteClient';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { verifyNoRunFromPackageSetting } from '../verifyNoRunFromPackageSetting';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function localGitDeploy(client: ISiteClient, fsPath: string, context: IActionContext): Promise<void> {
    const publishCredentials: User = await client.getWebAppPublishCredential();
    const publishingPassword: string = nonNullProp(publishCredentials, 'publishingPassword');

    await callWithMaskHandling(
        async (): Promise<void> => {
            const remote: string = `https://${nonNullProp(publishCredentials, 'publishingUserName')}:${nonNullProp(publishCredentials, 'publishingPassword')}@${client.gitUrl}`;
            const localGit: git.SimpleGit = git(fsPath);
            const commitId: string = (await localGit.log()).latest.hash;

            try {
                const status: git.StatusResult = await localGit.status();
                if (status.files.length > 0) {
                    context.telemetry.properties.cancelStep = 'pushWithUncommitChanges';
                    const message: string = localize('localGitUncommit', '{0} uncommitted change(s) in local repo "{1}"', status.files.length, fsPath);
                    const deployAnyway: vscode.MessageItem = { title: localize('deployAnyway', 'Deploy Anyway') };
                    await ext.ui.showWarningMessage(message, { modal: true }, deployAnyway, DialogResponses.cancel);
                    context.telemetry.properties.cancelStep = undefined;
                    context.telemetry.properties.pushWithUncommitChanges = 'true';
                }

                await verifyNoRunFromPackageSetting(client);
                ext.outputChannel.appendLog(localize('localGitDeploy', `Deploying Local Git repository to "${client.fullName}"...`), { resourceName: client.fullName });
                await tryPushAndWaitForDeploymentToComplete();

            } catch (err) {
                // tslint:disable-next-line:no-unsafe-any
                if (err.message.indexOf('spawn git ENOENT') >= 0) {
                    const installString: string = localize('Install', 'Install');
                    const input: string | undefined = await vscode.window.showErrorMessage(localize('GitRequired', 'Git must be installed to use Local Git Deploy.'), installString);
                    if (input === installString) {
                        await openUrl('https://git-scm.com/downloads');
                    }
                    context.telemetry.properties.gitNotInstalled = 'true';
                    return undefined;
                    // tslint:disable-next-line:no-unsafe-any
                } else if (err.message.indexOf('error: failed to push') >= 0) {
                    const forcePushMessage: vscode.MessageItem = { title: localize('forcePush', 'Force Push') };
                    const pushReject: string = localize('localGitPush', 'Push rejected due to Git history diverging.');

                    if (await ext.ui.showWarningMessage(pushReject, { modal: true }, forcePushMessage, DialogResponses.cancel) === forcePushMessage) {
                        context.telemetry.properties.forcePush = 'true';
                        await tryPushAndWaitForDeploymentToComplete(true);
                    } else {
                        context.telemetry.properties.cancelStep = 'forcePush';
                        throw new UserCancelledError();
                    }
                } else {
                    throw err;
                }
            }

            async function tryPushAndWaitForDeploymentToComplete(forcePush: boolean = false): Promise<void> {
                const tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
                const token: vscode.CancellationToken = tokenSource.token;
                try {
                    await new Promise((resolve: () => void, reject: (error: Error) => void): void => {
                        // for whatever reason, is '-f' exists, true or false, it still force pushes
                        const pushOptions: git.Options = forcePush ? { '-f': true } : {};

                        localGit.push(remote, 'HEAD:master', pushOptions).catch(async (error) => {
                            // tslint:disable-next-line:no-unsafe-any
                            reject(error);
                            tokenSource.cancel();
                        });

                        waitForDeploymentToComplete(context, client, commitId, token).then(resolve).catch(reject);
                    });
                } finally {
                    tokenSource.dispose();
                }
            }
        },
        publishingPassword);
}
