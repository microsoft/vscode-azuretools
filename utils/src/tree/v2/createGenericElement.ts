/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as types from '../../../index';

export function createGenericElement(options: types.GenericElementOptions): types.TreeElementBase {
    let commandArgs = options.commandArgs;
    const item = {
        id: options.id,
        getTreeItem(): vscode.TreeItem {
            return {
                ...options,
                command: options.commandId ? {
                    title: '',
                    command: options.commandId,
                    arguments: commandArgs,
                } : undefined,
            }
        }
    };

    // if command args is not set, then set it to the item itself
    commandArgs ??= [item];
    return item;
}
