/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteSourceControl } from 'azure-arm-website/lib/models';
import { MessageItem } from 'vscode';
import { AzureTreeItem, IActionContext } from 'vscode-azureextensionui';
import { editScmType } from './';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { ScmType } from './ScmType';
import { DeploymentsTreeItem } from './tree/DeploymentsTreeItem';

export async function disconnectRepo(context: IActionContext, node: DeploymentsTreeItem): Promise<void> {
    if (node.root && node.parent instanceof AzureTreeItem) {
        const sourceControl: SiteSourceControl = await node.root.client.getSourceControl();
        const disconnectButton: MessageItem = { title: localize('disconnect', 'Disconnect') };
        const disconnect: string = localize('disconnectFromRepo', 'Disconnect from "{0}"? This will not affect your app\'s active deployment. You may reconnect a repository at any time.', sourceControl.repoUrl);
        await ext.ui.showWarningMessage(disconnect, { modal: true }, disconnectButton);
        await editScmType(node.root.client, node.parent, context, ScmType.None);
        await node.refresh();
    } else {
        throw Error(localize('actionNotSupported', 'Action not supported.'));
    }
}
