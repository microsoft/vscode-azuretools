/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, Uri, TelemetryTrustedValue } from 'vscode';
import * as types from '../index';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { ext } from './extensionVariables';
import { addTreeItemValuesToMask } from './tree/addTreeItemValuesToMask';
import { AzExtTreeItem } from './tree/AzExtTreeItem';
import { unwrapArgs } from '@microsoft/vscode-azureresources-api';
import { parseError } from './parseError';

function isTreeElementBase(object?: unknown): object is types.TreeElementBase {
    return typeof object === 'object' && object !== null && 'getTreeItem' in object;
}

// if the firstArg has a resource property, it is a ResourceGroupsItem from the resource groups extension
function isResourceGroupsItem(object?: unknown): object is types.ResourceGroupsItem {
    return typeof object === 'object' && object !== null && 'resource' in object;
}

// resource has a lot of properties but for the sake of telemetry, we are interested in the id and subscriptionId
type Resource = {
    id?: string;
    subscription?: {
        subscriptionId?: string;
    };
}

export function registerCommand(commandId: string, callback: (context: types.IActionContext, ...args: unknown[]) => unknown, debounce?: number, telemetryId?: string): void {
    let lastClickTime: number | undefined; /* Used for debounce */
    ext.context.subscriptions.push(commands.registerCommand(commandId, async (...args: unknown[]): Promise<unknown> => {
        if (debounce) { /* Only check for debounce if registered command specifies */
            if (debounceCommand(debounce, lastClickTime)) {
                return;
            }
            lastClickTime = Date.now();
        }
        return await callWithTelemetryAndErrorHandling(
            telemetryId || commandId,
            async (context: types.IActionContext) => {
                if (args.length > 0) {
                    try {
                        await setTelemetryProperties(context, args);
                    } catch (e: unknown) {
                        const error = parseError(e);
                        // if we fail to set telemetry properties, we don't want to throw an error and prevent the command from executing
                        ext.outputChannel.appendLine(`registerCommand: Failed to set telemetry properties: ${e}`);
                        context.telemetry.properties.telemetryError = error.message;
                    }
                }

                return callback(context, ...args);
            }
        );
    }));
}

function debounceCommand(debounce: number, lastClickTime?: number): boolean {
    if (lastClickTime && lastClickTime + debounce > Date.now()) {
        return true;
    }
    return false;
}

async function setTelemetryProperties(context: types.IActionContext, args: unknown[]): Promise<void> {
    const firstArg: unknown = args[0];

    if (firstArg instanceof Uri) {
        context.telemetry.properties.contextValue = 'Uri';
    } else if (firstArg && typeof firstArg === 'object' && 'contextValue' in firstArg && typeof firstArg.contextValue === 'string') {
        context.telemetry.properties.contextValue = firstArg.contextValue;
    } else if (isTreeElementBase(firstArg)) {
        context.telemetry.properties.contextValue = (await firstArg.getTreeItem()).contextValue;
    }

    // handles items from the resource groups extension
    if (isResourceGroupsItem(firstArg)) {
        const resourceId = (firstArg as { resource: Resource })?.resource?.id;
        if (resourceId) {
            context.telemetry.properties.resourceId = new TelemetryTrustedValue(resourceId);
        }
        context.telemetry.properties.subscriptionId = (firstArg as { resource: Resource })?.resource?.subscription?.subscriptionId;
    }

    // handles items from v1 extensions
    for (const arg of args) {
        if (arg instanceof AzExtTreeItem) {
            try {
                // Only record telemetry if subscription is defined. See: https://github.com/microsoft/vscode-azuretools/pull/1941#discussion_r2016824347
                if (arg.subscription) {
                    if (arg.id) {
                        context.telemetry.properties.resourceId = new TelemetryTrustedValue(arg.id);
                    }
                    // it's possible that if subscription is not set on AzExtTreeItems, an error is thrown from just accessing it
                    // see https://github.com/microsoft/vscode-azuretools/blob/cc1feb3a819dd503eb59ebcc1a70051d4e9a3432/utils/src/tree/AzExtTreeItem.ts#L154
                    context.telemetry.properties.subscriptionId = arg.subscription.subscriptionId;
                }
            } catch (e) {
                // we don't want to block execution of the command just because we can't set the telemetry properties
                // see https://github.com/microsoft/vscode-azureresourcegroups/issues/1080
            }
            addTreeItemValuesToMask(context, arg, 'command');
        }
    }

    // handles items from v2 extensions that are shaped like:
    // id: string;
    // subscription: {
    //     subscriptionId: string;
    // }
    // we don't enforce this shape so it won't work in all cases, but for ACA we mostly follow this pattern
    const [node] = unwrapArgs(args);
    try {
        // Only record telemetry if subscription is defined. Prevents trying to record resourceId/subId on items unrelated to Azure.
        // See: https://github.com/microsoft/vscode-azuretools/pull/1941#discussion_r2016824347
        if (node && typeof node === 'object' && 'subscription' in node && node.subscription) {

            if (node && typeof node === 'object' && 'id' in node && typeof node.id === 'string') {
                context.telemetry.properties.resourceId = new TelemetryTrustedValue(node.id);
            }

            // it's possible that if subscription is not set on AzExtTreeItems, an error is thrown from just accessing it
            // see https://github.com/microsoft/vscode-azuretools/blob/cc1feb3a819dd503eb59ebcc1a70051d4e9a3432/utils/src/tree/AzExtTreeItem.ts#L154
            if (typeof node.subscription === 'object' && 'subscriptionId' in node.subscription && typeof node.subscription.subscriptionId === 'string') {
                context.telemetry.properties.subscriptionId = node.subscription.subscriptionId;
            }
        }
    } catch (e) {
        // we don't want to block execution of the command just because we can't set the telemetry properties
        // see https://github.com/microsoft/vscode-azureresourcegroups/issues/1080
    }
}
