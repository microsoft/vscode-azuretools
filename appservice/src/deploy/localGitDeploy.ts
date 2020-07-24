/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import { callWithMaskHandling, IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { ISimplifiedSiteClient } from '../ISimplifiedSiteClient';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { verifyNoRunFromPackageSetting } from '../verifyNoRunFromPackageSetting';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

type localGitOptions = {
    fsPath: string;
    /**
     * Set if you want to specify what branch to push to. Default is `HEAD:master`.
     */
    branch?: string;
    /**
     * Set to `true` if you want to commit changes before pushing.
     */
    commit?: boolean;
};

export async function localGitDeploy(client: ISimplifiedSiteClient, options: localGitOptions, context: IActionContext): Promise<void> {
    const publishCredentials: WebSiteManagementModels.User = await client.getWebAppPublishCredential();
    const publishingPassword: string = nonNullProp(publishCredentials, 'publishingPassword');
    const publishingUserName: string = nonNullProp(publishCredentials, 'publishingUserName');

    await callWithMaskHandling(
        async (): Promise<void> => {
            const remote: string = `https://${encodeURIComponent(publishingUserName)}:${encodeURIComponent(publishingPassword)}@${client.gitUrl}`;
            const localGit: git.SimpleGit = git(options.fsPath);
            let status: git.StatusResult;
            try {
                status = await localGit.status();
                if (status.files.length > 0 && !options.commit) {
                    context.telemetry.properties.cancelStep = 'pushWithUncommitChanges';
                    const message: string = localize('localGitUncommit', '{0} uncommitted change(s) in local repo "{1}"', status.files.length, options.fsPath);
                    const deployAnyway: vscode.MessageItem = { title: localize('deployAnyway', 'Deploy Anyway') };
                    await ext.ui.showWarningMessage(message, { modal: true }, deployAnyway);
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

                    context.telemetry.properties.cancelStep = 'forcePush';
                    await ext.ui.showWarningMessage(pushReject, { modal: true }, forcePushMessage);
                    context.telemetry.properties.cancelStep = undefined;
                    context.telemetry.properties.forcePush = 'true';
                    await tryPushAndWaitForDeploymentToComplete(true);
                } else {
                    throw err;
                }
            }

            async function tryPushAndWaitForDeploymentToComplete(forcePush: boolean = false): Promise<void> {
                const tokenSource: vscode.CancellationTokenSource = new vscode.CancellationTokenSource();
                const token: vscode.CancellationToken = tokenSource.token;
                try {
                    if (options.commit) {
                        const commitOptions: git.Options = { '-a': null };
                        await localGit.commit('Deployed via Azure App Service Extension', undefined, commitOptions);
                    }
                    const commitId: string = (await localGit.log()).latest.hash;

                    await new Promise((resolve: () => void, reject: (error: Error) => void): void => {

                        const pushOptions: git.Options = forcePush ? { '-f': null } : {};

                        localGit.push(remote, `HEAD:${options.branch ?? 'master'}`, pushOptions).catch(async (error) => {
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
