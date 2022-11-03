/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export interface PickFilter<TPick = vscode.TreeItem> {
    /**
     * Filters for nodes that match the final target.
     * @param node The node to apply the filter to
     */
    isFinalPick(node: TPick): boolean;

    /**
     * Filters for nodes that could have a descendant matching the final target.
     * @param node The node to apply the filter to
     */
    isAncestorPick(node: TPick): boolean;
}
