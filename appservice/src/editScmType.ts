/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from 'azure-arm-website/lib/models';
import * as vscode from 'vscode';
import { IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { connectToGitHub } from './connectToGithub';
import { localize } from './localize';
import { ScmType } from './ScmType';
import { SiteClient } from './SiteClient';

export async function editScmType(client: SiteClient, node: IAzureNode, outputChannel: vscode.OutputChannel): Promise<string | undefined> {
    const config: SiteConfigResource = await client.getSiteConfig();
    const newScmType: string = await showScmPrompt(config.scmType);
    if (newScmType === ScmType.GitHub) {
        if (config.scmType !== ScmType.None) {
            // GitHub cannot be configured if there is an existing configuration source-- a limitation of Azure
            throw new Error(localize('configurationError', 'Configuration type must be set to "None" to connect to a GitHub repository.'));
        }
        await connectToGitHub(node, client, outputChannel);
    } else {
        config.scmType = newScmType;
        // to update one property, a complete config file must be sent
        await client.updateConfiguration(config);
    }
    outputChannel.appendLine(localize('deploymentSourceUpdated,', 'Deployment source has been updated to "{0}".', newScmType));
    // returns the updated scmType
    return newScmType;
}

async function showScmPrompt(currentScmType: string): Promise<string> {
    const placeHolder: string = localize('scmPrompt', 'Select a new source.');
    const currentSource: string = localize('currentSource', '(Current source)');
    const scmQuickPicks: vscode.QuickPickItem[] = [];
    // generate quickPicks to not include current type
    for (const scmQuickPick of Object.keys(ScmType)) {
        if (scmQuickPick === currentScmType) {
            // put the current source at the top of the list
            scmQuickPicks.unshift({ label: scmQuickPick, description: currentSource });
        } else {
            scmQuickPicks.push({ label: scmQuickPick, description: '' });
        }
    }

    const quickPick: vscode.QuickPickItem = await vscode.window.showQuickPick(scmQuickPicks, { placeHolder: placeHolder });
    if (quickPick === undefined || quickPick.description === currentSource) {
        // if the user clicks the current source, treat it as a cancel
        throw new UserCancelledError();
    } else {
        return quickPick.label;
    }
}
