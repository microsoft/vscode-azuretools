/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IActionContext } from '../types/actionContext';
import type { AzExtTreeItem } from './AzExtTreeItem';
import { addValuesToMaskFromAzureId } from '../masking';

/**
 * @param treeItemSource a string id used to track the tree item source in telemetry
 */
export function addTreeItemValuesToMask(context: IActionContext, treeItem: AzExtTreeItem, treeItemSource: string): void {
    addValuesToMaskFromAzureId(context, treeItem.fullId);
    context.telemetry.properties.treeItemSource = treeItemSource;

    let tiToMask: AzExtTreeItem | undefined = treeItem;
    while (tiToMask) {
        if (!tiToMask.suppressMaskLabel) {
            context.valuesToMask.push(tiToMask.label);
        }
        context.valuesToMask.push(...tiToMask.valuesToMask);
        tiToMask = tiToMask.parent;
    }
}
