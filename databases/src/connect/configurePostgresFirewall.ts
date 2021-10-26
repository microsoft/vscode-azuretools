/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import publicIp = require('public-ip');
import * as vscode from 'vscode';
import { DialogResponses, IActionContext, ISubscriptionContext } from "vscode-azureextensionui";
import { DBTreeItem } from '..';
import { createAbstractPostgresClient } from '../create/PostgresAccountWizard/abstract/AbstractPostgresClient';
import { AbstractFirewallRule, PostgresServerType } from '../create/PostgresAccountWizard/abstract/models';
import { ext } from '../extensionVariables';
import { localize } from '../utils/localize';
import { nonNullProp } from '../utils/nonNull';
import { randomUtils } from '../utils/randomUtils';


export async function configurePostgresFirewall(context: ISubscriptionContext & IActionContext, databaseTreeItem: DBTreeItem): Promise<void> {

    const ip: string = await getPublicIp();
    await context.ui.showWarningMessage(
        localize('firewallRuleWillBeAdded', 'A firewall rule for your IP ({0}) will be added to server "{1}". Would you like to continue?', ip, databaseTreeItem.hostName),
        {
            modal: true,
            stepName: 'postgresAddFirewallRule'
        },
        { title: DialogResponses.yes.title }
    );

    await setFirewallRule(context, databaseTreeItem, ip);
}

export async function setFirewallRule(context: ISubscriptionContext & IActionContext, databaseTreeItem: DBTreeItem, ip: string): Promise<void> {

    const postgresData = nonNullProp(databaseTreeItem, 'postgresData');
    const azureData = nonNullProp(databaseTreeItem, 'azureData');
    const serverType: PostgresServerType = nonNullProp(postgresData, 'serverType');
    const client = createAbstractPostgresClient(serverType, context);
    const resourceGroup: string = nonNullProp(azureData, 'resourceGroup');
    const serverName: string = nonNullProp(azureData, 'accountName');

    const firewallRuleName: string = "azDbVSCode-Ip" + `-${randomUtils.getRandomHexString(6)}`;

    const newFirewallRule: AbstractFirewallRule = {
        startIpAddress: ip,
        endIpAddress: ip
    };

    const progressMessage: string = localize('configuringFirewallRule', 'Adding firewall rule for IP "{0}" to server "{1}"...', ip, serverName);
    const options: vscode.ProgressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: progressMessage
    };
    ext.outputChannel.appendLog(progressMessage);
    await vscode.window.withProgress(options, async () => {
        await (await client).firewallRules.createOrUpdate(resourceGroup, serverName, firewallRuleName, newFirewallRule);
    });
    const completedMessage: string = localize('addedFirewallRule', 'Successfully added firewall rule for IP "{0}" to server "{1}".', ip, serverName);
    void vscode.window.showInformationMessage(completedMessage);
    ext.outputChannel.appendLog(completedMessage);
}

export async function getPublicIp(): Promise<string> {
    const options: vscode.ProgressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: localize('gettingPublicIp', 'Getting public IP...')
    };

    return await vscode.window.withProgress(options, async () => {
        return await publicIp.v4();
    });
}
