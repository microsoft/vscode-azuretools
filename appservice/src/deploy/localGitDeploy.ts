/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary, User } from 'azure-arm-website/lib/models';
import * as opn from 'opn';
import * as git from 'simple-git/promise';
import * as vscode from 'vscode';
import { DialogResponses } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { cpUtils } from '../utils/cpUtils';
import { nonNullProp } from '../utils/nonNull';
import { formatDeployLog } from './formatDeployLog';
import { CommandOptions } from '../CommandOptions';

export async function localGitDeploy(client: SiteClient, fsPath: string): Promise<void> {
    const publishCredentials: User = await client.getWebAppPublishCredential();
    const remote: string = nonNullProp(publishCredentials, 'scmUri');
    const localGit: git.SimpleGit = git(fsPath);
    const status: git.StatusResult = await localGit.status();
    if (status.files.length > 0) {
        const message: string = localize('localGitUncommit', '{0} uncommitted change(s) in local repo "{1}"', status.files.length, fsPath);
        const deployAnyway: vscode.MessageItem = { title: localize('deployAnyway', 'Deploy Anyway') };
        await ext.ui.showWarningMessage(message, { modal: true }, deployAnyway, DialogResponses.cancel);
    }

    await verifyNoRunFromPackageSetting(client);
    ext.outputChannel.appendLine(formatDeployLog(client, (localize('localGitDeploy', `Deploying Local Git repository to "${client.fullName}"...`))));
    const commandOptions: CommandOptions = new CommandOptions(`git push ${remote} HEAD:master`, ext.outputChannel, fsPath, publishCredentials.publishingPassword);
    const result: cpUtils.ICommandResult = await cpUtils.tryExecuteCommand(commandOptions);
    // a non-0 code indicates that there was an error with the cmd
    if (result.code !== 0) {
        if (result.cmdOutputIncludingStderr.indexOf('spawn git ENOENT') >= 0) {
            const installString: string = localize('Install', 'Install');
            const input: string | undefined = await vscode.window.showErrorMessage(localize('GitRequired', 'Git must be installed to use Local Git Deploy.'), installString);
            if (input === installString) {
                // tslint:disable-next-line:no-unsafe-any
                opn('https://git-scm.com/downloads');
            }
            return undefined;
        } else if (result.cmdOutputIncludingStderr.indexOf('error: failed to push') >= 0) {
            const forcePush: vscode.MessageItem = { title: localize('forcePush', 'Force Push') };
            const pushReject: string = localize('localGitPush', 'Push rejected due to Git history diverging.');
            await ext.ui.showWarningMessage(pushReject, forcePush, DialogResponses.cancel);
            commandOptions.command = `git push -f ${remote} HEAD:master`;
            await cpUtils.executeCommand(commandOptions);
        } else {
            throw result.cmdOutputIncludingStderr;
        }
    }
}

async function verifyNoRunFromPackageSetting(client: SiteClient): Promise<void> {
    let updateSettings: boolean = false;
    const runFromPackageSettings: string[] = ['WEBSITE_RUN_FROM_PACKAGE', 'WEBSITE_RUN_FROM_ZIP'];
    const applicationSettings: StringDictionary = await client.listApplicationSettings();
    for (const settingName of runFromPackageSettings) {
        if (applicationSettings.properties && applicationSettings.properties[settingName]) {
            delete applicationSettings.properties[settingName];
            ext.outputChannel.appendLine(formatDeployLog(client, localize('deletingSetting', 'Deleting setting "{0}"...', settingName)));
            updateSettings = true;
        }
    }

    if (updateSettings) {
        await client.updateApplicationSettings(applicationSettings);
    }
}
