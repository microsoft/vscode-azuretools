/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ProviderResult, TreeItem } from 'vscode';
import type { ResourceModelBase } from '@microsoft/vscode-azureresources-api';
import type { IGenericTreeItemOptions } from './treeItem';

/**
 * Base element for a tree view (v2)
 */
export interface TreeElementBase extends ResourceModelBase {
    getChildren?(): ProviderResult<TreeElementBase[]>;
    getTreeItem(): TreeItem | Thenable<TreeItem>;
}

export type TreeElementWithId = TreeElementBase & { id: string };

export interface GenericElementOptions extends IGenericTreeItemOptions {
    commandArgs?: unknown[];
}

export interface TreeElementStateModel {
    /**
     * Apply a temporary description to the tree item
     */
    temporaryDescription?: string;
    /**
     * Set the tree item icon to a spinner
     */
    spinner?: boolean;
    /**
     * Temporary children to be displayed
     */
    temporaryChildren?: TreeElementBase[];
}
