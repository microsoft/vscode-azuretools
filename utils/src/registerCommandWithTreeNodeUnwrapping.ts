/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { unwrapArgs } from '@microsoft/vscode-azureresources-api';
import type { IActionContext, TreeNodeCommandCallback } from '../index';
import { registerCommand } from './registerCommand';

/**
 * Used to register VSCode tree node context menu commands that are in the host extension's tree. It wraps your callback with consistent error and telemetry handling
 * Use debounce property if you need a delay between clicks for this particular command
 * A telemetry event is automatically sent whenever a command is executed. The telemetry event ID will default to the same as the
 *   commandId passed in, but can be overridden per command with telemetryId
 * The telemetry event for this command will be named telemetryId if specified, otherwise it defaults to the commandId
 * NOTE: If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then telemetry will not be sent. If the value is 'verbose' or 'v', telemetry will be displayed in the console window.
 */
export function registerCommandWithTreeNodeUnwrapping<T>(commandId: string, treeNodeCallback: TreeNodeCommandCallback<T>, debounce?: number, telemetryId?: string): void {
    registerCommand(commandId, unwrapTreeNodeCommandCallback(treeNodeCallback), debounce, telemetryId);
}

export function unwrapTreeNodeCommandCallback<T>(treeNodeCallback: TreeNodeCommandCallback<T>): TreeNodeCommandCallback<T> {
    return async (context: IActionContext, ...args: unknown[]) => {
        return treeNodeCallback(context, ...unwrapArgs<T>(args));
    };
}
