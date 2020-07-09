/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzExtTreeItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { getWorkspaceSetting, updateWorkspaceSetting } from '../utils/settings';
import { AppSource, IDeployContext } from './IDeployContext';

/**
 * Converts the args passed in by VS Code and any relevant settings into the node used to deploy
 *
 * @param arg1 The first arg passed in by VS Code to the deploy command. Typically the node or uri
 * @param arg2 The second arg passed in by VS Code to the deploy command. Usually this is ignored, but can be the appId if called programatically from an API
 */
export async function getDeployNode<T extends AzExtTreeItem>(context: IDeployContext, arg1: unknown, arg2: unknown, expectedContextValue: string | string[]): Promise<T> {
    let node: AzExtTreeItem | undefined;

    if (arg1 instanceof AzExtTreeItem) {
        node = arg1;
        context.appSource = AppSource.tree;
    } else if (typeof arg2 === 'string' && arg2) {
        node = await ext.tree.findTreeItem(arg2, context);
        if (!node) {
            throw new Error(localize('noMatchingApp', 'Failed to find app matching id "{0}".', arg2));
        }
        context.appSource = AppSource.api;
    } else {
        const defaultAppId: string | undefined = getWorkspaceSetting(context.defaultAppSetting, ext.prefix, context.workspaceFolder.uri.fsPath);
        if (defaultAppId && defaultAppId.toLowerCase() !== 'none') {
            node = await ext.tree.findTreeItem(defaultAppId, context);
            if (node) {
                context.appSource = AppSource.setting;
            } else {
                // if defaultPath or defaultNode cannot be found or there was a mismatch, delete old setting and prompt to save next deployment
                await updateWorkspaceSetting(context.defaultAppSetting, undefined, context.workspaceFolder.uri.fsPath, ext.prefix);
            }
        }

        if (!node) {
            const newNodes: AzExtTreeItem[] = [];
            const disposable: vscode.Disposable = ext.tree.onTreeItemCreate(newNode => { newNodes.push(newNode); });
            try {
                node = await ext.tree.showTreeItemPicker<AzExtTreeItem>(expectedContextValue, context);
            } finally {
                disposable.dispose();
            }
            context.isNewApp = newNodes.some(newNode => node && newNode.fullId === node.fullId);
            context.appSource = AppSource.nodePicker;
        }
    }

    context.telemetry.properties.appSource = context.appSource;
    context.telemetry.properties.isNewApp = String(!!context.isNewApp);
    return <T>node;
}
