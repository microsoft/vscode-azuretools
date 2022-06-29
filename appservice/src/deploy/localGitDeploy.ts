/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { User } from '@azure/arm-appservice';
import { callWithMaskHandling, IActionContext, nonNullProp } from '@microsoft/vscode-azext-utils';
import simpleGit, { Options, SimpleGit, StatusResult } from 'simple-git';
import * as vscode from 'vscode';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ParsedSite } from '../SiteClient';
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

export async function localGitDeploy(site: ParsedSite, options: localGitOptions, context: IActionContext): Promise<void> {
    const client = await site.createClient(context);
    const publishCredentials: User = await client.getWebAppPublishCredential();
    const publishingPassword: string = nonNullProp(publishCredentials, 'publishingPassword');
    const publishingUserName: string = nonNullProp(publishCredentials, 'publishingUserName');

    await callWithMaskHandling(
        async (): Promise<void> => {
            const remote: string = `https://${encodeURIComponent(publishingUserName)}:${encodeURIComponent(publishingPassword)}@${site.gitUrl}`;
            const localGit: SimpleGit = simpleGit(options.fsPath);
            let status: StatusResult;
            try {
                status = await localGit.status();
                if (status.files.length > 0 && !options.commit) {
                    const message: string = localize('localGitUncommit', '{0} uncommitted change(s) in local repo "{1}"', status.files.length, options.fsPath);
                    const deployAnyway: vscode.MessageItem = { title: localize('deployAnyway', 'Deploy Anyway') };
                    await context.ui.showWarningMessage(message, { modal: true, stepName: 'pushWithUncommitChanges' }, deployAnyway);
                    context.telemetry.properties.pushWithUncommitChanges = 'true';
                }
                await verifyNoRunFromPackageSetting(context, site);
                ext.outputChannel.appendLog(localize('localGitDeploy', `Deploying Local Git repository to "${site.fullName}"...`), { resourceName: site.fullName });
                await tryPushAndWaitForDeploymentToComplete();

            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                if (err.message.indexOf('spawn git ENOENT') >= 0) {
                    const installString: string = localize('Install', 'Install');
                    const input: string | undefined = await vscode.window.showErrorMessage(localize('GitRequired', 'Git must be installed to use Local Git Deploy.'), installString);
                    if (input === installString) {
                        await openUrl('https://git-scm.com/downloads');
                    }
                    context.telemetry.properties.gitNotInstalled = 'true';
                    return undefined;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                } else if (err.message.indexOf('error: failed to push') >= 0) {
                    const forcePushMessage: vscode.MessageItem = { title: localize('forcePush', 'Force Push') };
                    const pushReject: string = localize('localGitPush', 'Push rejected due to Git history diverging.');

                    await context.ui.showWarningMessage(pushReject, { modal: true, stepName: 'forcePush' }, forcePushMessage);
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
                        const commitOptions: Options = { '-a': null };
                        await localGit.commit('Deployed via Azure App Service Extension', undefined, commitOptions);
                    }
                    const commitId: string | undefined = (await localGit.log()).latest?.hash;

                    await new Promise<void>((resolve: () => void, reject: (error: Error) => void): void => {

                        const pushOptions: Options = forcePush ? { '-f': null } : {};

                        localGit.push(remote, `HEAD:${options.branch ?? 'master'}`, pushOptions).catch((error) => {
                            reject(error);
                            tokenSource.cancel();
                        });

                        waitForDeploymentToComplete(context, site, {expectedId: commitId, token}).then(resolve).catch(reject);
                    });
                } finally {
                    tokenSource.dispose();
                }
            }
        },
        publishingPassword);
}
