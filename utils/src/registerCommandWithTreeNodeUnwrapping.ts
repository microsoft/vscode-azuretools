/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { unwrapArgs } from '@microsoft/vscode-azureresources-api';
import type { IActionContext, TreeNodeCommandCallback } from '../index';
import { registerCommand } from './registerCommand';

export function registerCommandWithTreeNodeUnwrapping<T>(commandId: string, treeNodeCallback: TreeNodeCommandCallback<T>, debounce?: number, telemetryId?: string): void {
    registerCommand(commandId, unwrapTreeNodeCommandCallback(treeNodeCallback), debounce, telemetryId);
}

export function unwrapTreeNodeCommandCallback<T>(treeNodeCallback: TreeNodeCommandCallback<T>): TreeNodeCommandCallback<T> {
    return async (context: IActionContext, ...args: unknown[]) => {
        return treeNodeCallback(context, ...unwrapArgs<T>(args));
    };
}
