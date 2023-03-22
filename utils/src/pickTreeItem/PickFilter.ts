/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export interface PickFilter<TPick = vscode.TreeItem> {
    /**
     * Filters for nodes that match the final target.
     *
     * @param treeItem - The tree item to apply the filter to
     * @param element - The element to apply the filter to. May be a `Wrapper`.
     */
    isFinalPick(treeItem: TPick, element: unknown): boolean;
    /**
     * Filters for nodes that could be an ancestor of a node matching the final target.
     *
     * @param treeItem - The tree item to apply the filter to
     * @param element - The element to apply the filter to. May be a `Wrapper`.
     */
    isAncestorPick(treeItem: TPick, element: unknown): boolean;
}
