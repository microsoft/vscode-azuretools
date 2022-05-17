/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UserCancelledError } from '@microsoft/vscode-azext-utils';
import { join } from 'path';
import { commands, MessageItem, Uri, window } from "vscode";
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ParsedSite } from '../SiteClient';
import { delay } from '../utils/delay';
import { updateWorkspaceSetting } from '../utils/settings';
import { AppSource, IDeployContext } from './IDeployContext';

export async function showDeployConfirmation(context: IDeployContext, site: ParsedSite, deployCommandId: string): Promise<void> {
    const warning: string = localize('confirmDeploy', 'Are you sure you want to deploy to "{0}"? This will overwrite any previous deployment and cannot be undone.', site.fullName);
    const items: MessageItem[] = [{ title: localize('deploy', 'Deploy') }];
    const resetDefault: MessageItem = { title: 'Reset default' };
    if (context.appSource === AppSource.setting) {
        items.push(resetDefault);
    }

    const result: MessageItem = await context.ui.showWarningMessage(warning, { modal: true, stepName: 'confirmDestructiveDeployment' }, ...items);

    // a temporary workaround for this issue:
    // https://github.com/Microsoft/vscode-azureappservice/issues/844
    await delay(500);

    if (result === resetDefault) {
        const settingsPath: string = join(context.workspaceFolder.uri.fsPath, '.vscode', 'settings.json');
        await updateWorkspaceSetting(context.defaultAppSetting, '', context.workspaceFolder.uri.fsPath, ext.prefix);
        await window.showTextDocument(Uri.file(settingsPath));

        // If resetDefault button was clicked we ask what and where to deploy again
        // don't wait
        void commands.executeCommand(deployCommandId);
        throw new UserCancelledError('resetDefault');
    }
}
