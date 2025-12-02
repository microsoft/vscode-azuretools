/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import * as types from '../index';

export function executeCommandWithAddedContext<T = unknown>(commandId: string, additionalContext: Partial<types.IActionContext>, ...args: unknown[]): Thenable<T> {
    // Special metadata arg signaling context injection
    const metadata = { injectedContext: additionalContext };
    return vscode.commands.executeCommand(commandId, metadata, ...args);
}
