/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SiteSourceControl } from '@azure/arm-appservice';
import { IActionContext, ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import { l10n, MessageItem } from 'vscode';
import { editScmType } from './editScmType';
import { ScmType } from './ScmType';
import { ParsedSite } from './SiteClient';

export async function disconnectRepo(context: IActionContext, site: ParsedSite, subscriptionContext: ISubscriptionContext): Promise<void> {
    const client = await site.createClient(context);
    const sourceControl: SiteSourceControl = await client.getSourceControl();
    const disconnectButton: MessageItem = { title: l10n.t('Disconnect') };
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const disconnect: string = l10n.t('Disconnect from "{0}"? This will not affect your app\'s active deployment. You may reconnect a repository at any time.', sourceControl.repoUrl!);
    await context.ui.showWarningMessage(disconnect, { modal: true, stepName: 'disconnectRepo' }, disconnectButton);
    await editScmType(context, site, subscriptionContext, ScmType.None);
}
