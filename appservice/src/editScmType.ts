/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource } from 'azure-arm-website/lib/models';
import { IAzureNode, IAzureQuickPickItem, IAzureQuickPickOptions, UserCancelledError } from 'vscode-azureextensionui';
import { connectToGitHub } from './connectToGitHub';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { ScmType } from './ScmType';
import { SiteClient } from './SiteClient';

export async function editScmType(client: SiteClient, node: IAzureNode): Promise<string | undefined> {
    const config: SiteConfigResource = await client.getSiteConfig();
    const newScmType: string = await showScmPrompt(config.scmType);
    if (newScmType === ScmType.GitHub) {
        if (config.scmType !== ScmType.None) {
            // GitHub cannot be configured if there is an existing configuration source-- a limitation of Azure
            throw new Error(localize('configurationError', 'Configuration type must be set to "None" to connect to a GitHub repository.'));
        }
        await connectToGitHub(node, client);
    } else {
        config.scmType = newScmType;
        // to update one property, a complete config file must be sent
        await client.updateConfiguration(config);
    }
    ext.outputChannel.appendLine(localize('deploymentSourceUpdated,', 'Deployment source has been updated to "{0}".', newScmType));
    // returns the updated scmType
    return newScmType;
}

async function showScmPrompt(currentScmType: string): Promise<string> {
    const currentSource: string = localize('currentSource', '(Current source)');
    const scmQuickPicks: IAzureQuickPickItem<string | undefined>[] = [];
    // generate quickPicks to not include current type
    for (const scmType of Object.keys(ScmType)) {
        if (scmType === currentScmType) {
            // put the current source at the top of the list
            scmQuickPicks.unshift({ label: scmType, description: currentSource, data: undefined });
        } else {
            scmQuickPicks.push({ label: scmType, description: '', data: scmType });
        }
    }

    const options: IAzureQuickPickOptions = {
        placeHolder: localize('scmPrompt', 'Select a new source.'),
        suppressPersistence: true
    };
    const newScmType: string | undefined = (await ext.ui.showQuickPick(scmQuickPicks, options)).data;
    if (newScmType === undefined) {
        // if the user clicks the current source, treat it as a cancel
        throw new UserCancelledError();
    } else {
        return newScmType;
    }
}
