/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { GenericElementOptions, TreeElementBase } from '../../types/treeV2';

/**
 * Creates a generic element.
 *
 * @param options - options for the generic item
 *
 * If `options.commandArgs` is not set, then it will be set to the item itself.
 */
export function createGenericElement(options: GenericElementOptions): TreeElementBase {
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
            };
        }
    };

    // if command args is not set, then set it to the item itself
    commandArgs ??= [item];
    return item;
}
