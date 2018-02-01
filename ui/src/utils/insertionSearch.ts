/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureNode } from '../treeDataProvider/AzureNode';

// returns the index of where the node should be inserted
export function insertionSearch(node: AzureNode, array: AzureNode[]): number {

    // tslint:disable-next-line:no-increment-decrement
    for (let i: number = 0; i < array.length; i++) {
        if (node.treeItem.label.localeCompare(array[i].treeItem.label) < 1) {
            return i;
        }
    }
    return array.length;
}
