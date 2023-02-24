/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SiteConfigResource, User } from '@azure/arm-appservice';
import { IActionContext, IAzureQuickPickItem, IAzureQuickPickOptions, ISubscriptionContext, nonNullProp, UserCancelledError } from '@microsoft/vscode-azext-utils';
import { l10n, window } from 'vscode';
import { ext } from './extensionVariables';
import { connectToGitHub } from './github/connectToGitHub';
import { ScmType } from './ScmType';
import { ParsedSite } from './SiteClient';

export async function editScmType(context: IActionContext, site: ParsedSite, subscriptionContext: ISubscriptionContext, newScmType?: ScmType, showToast: boolean = true): Promise<ScmType | undefined> {
    const client = await site.createClient(context);
    if (site.isLinux && await client.getIsConsumption(context)) {
        context.errorHandling.suppressReportIssue = true;
        throw new Error(l10n.t('Linux consumption plans only support zip deploy. See [here](https://aka.ms/AA7avjx) for more information.'));
    }

    const config: SiteConfigResource = await client.getSiteConfig();
    newScmType = newScmType ? newScmType : await showScmPrompt(context, nonNullProp(config, 'scmType'));
    if (newScmType === ScmType.GitHub) {
        if (config.scmType !== ScmType.None) {
            // GitHub cannot be configured if there is an existing configuration source-- a limitation of Azure
            await editScmType(context, site, subscriptionContext, ScmType.None, false);
        }
        await connectToGitHub(site, Object.assign(context, subscriptionContext));
    } else {
        config.scmType = newScmType;
        // to update one property, a complete config file must be sent
        await client.updateConfiguration(config);
    }
    if (showToast) {
        const scmTypeUpdated: string = l10n.t('Deployment source for "{0}" has been updated to "{1}".', site.fullName, newScmType);
        ext.outputChannel.appendLog(scmTypeUpdated);
        void window.showInformationMessage(scmTypeUpdated);
    }

    if (newScmType === ScmType.LocalGit) {
        const user: User = await client.getPublishingUser();
        if (user.publishingUserName) {
            // first time users must set up deployment credentials via the Portal or they will not have a UserName
            const gitCloneUri: string = `https://${user.publishingUserName}@${site.gitUrl}`;
            ext.outputChannel.appendLog(l10n.t('Git Clone Uri for "{0}": "{1}"', site.fullName, gitCloneUri));
        }
    }
    // returns the updated scmType
    return newScmType;
}

async function showScmPrompt(context: IActionContext, currentScmType: string): Promise<ScmType> {
    const currentSource: string = l10n.t('(Current source)');
    const scmQuickPicks: IAzureQuickPickItem<ScmType | undefined>[] = [];
    // generate quickPicks to not include current type
    for (const key of Object.keys(ScmType)) {
        const scmType: ScmType = <ScmType>ScmType[key];
        if (scmType === currentScmType) {
            // put the current source at the top of the list
            scmQuickPicks.unshift({ label: scmType, description: currentSource, data: undefined });
        } else {
            scmQuickPicks.push({ label: scmType, description: '', data: scmType });
        }
    }

    const options: IAzureQuickPickOptions = {
        placeHolder: l10n.t('Select a new source.'),
        suppressPersistence: true,
        stepName: 'editScmType'
    };
    const newScmType: ScmType | undefined = (await context.ui.showQuickPick(scmQuickPicks, options)).data;
    if (newScmType === undefined) {
        // if the user clicks the current source, treat it as a cancel
        throw new UserCancelledError('scmTypeAlreadyMatches');
    } else {
        return newScmType;
    }
}
