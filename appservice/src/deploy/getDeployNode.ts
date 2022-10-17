/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, IActionContext } from '@microsoft/vscode-azext-utils';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { getWorkspaceSetting } from '../utils/settings';
import { AppSource, IDeployContext } from './IDeployContext';

function isAzExtTreeItem(ti: unknown): ti is AzExtTreeItem {
    return !!ti && (ti as AzExtTreeItem).fullId !== undefined && (ti as AzExtTreeItem).fullId !== null;
}

/**
 * Converts the args passed in by VS Code and any relevant settings into the node used to deploy
 *
 * @param arg1 The first arg passed in by VS Code to the deploy command. Typically the node or uri
 * @param arg2 The second arg passed in by VS Code to the deploy command. Usually this is ignored, but can be the appId if called programatically from an API
 */
export async function getDeployNode<T extends AzExtTreeItem>(context: IDeployContext, findTreeItem: (context: IActionContext, azureResourceId: string) => Promise<AzExtTreeItem>, arg1: unknown, arg2: unknown, pickNode: () => Promise<T>): Promise<T> {
    let node: AzExtTreeItem | undefined;

    if (isAzExtTreeItem(arg1)) {
        node = arg1;
        context.appSource = AppSource.tree;
    } else if (typeof arg2 === 'string' && arg2) {
        node = await findTreeItem(context, arg2);
        if (!node) {
            throw new Error(localize('noMatchingApp', 'Failed to find app matching id "{0}".', arg2));
        }
        context.appSource = AppSource.api;
    } else {
        const defaultAppId: string | undefined = getWorkspaceSetting(context.defaultAppSetting, ext.prefix, context.workspaceFolder.uri.fsPath);
        if (defaultAppId && defaultAppId.toLowerCase() !== 'none') {
            node = await findTreeItem(context, defaultAppId);
            if (node) {
                context.appSource = AppSource.setting;
            } else {
                ext.outputChannel.appendLog(localize('appFromSettingNotFound', 'WARNING: Failed to find app matching setting "{0}.{1}" with id "{2}"', ext.prefix, context.defaultAppSetting, defaultAppId));
            }
        }

        if (!node) {
            node = await pickNode();
            context.isNewApp = false; // TODO: re-implement once users can create new apps from the quick pick
            context.appSource = AppSource.nodePicker;
        }
    }

    context.telemetry.properties.appSource = context.appSource;
    context.telemetry.properties.isNewApp = String(!!context.isNewApp);
    return <T>node;
}
