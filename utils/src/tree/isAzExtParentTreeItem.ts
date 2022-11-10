/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { AzExtParentTreeItem } from "./AzExtParentTreeItem";
import { AzExtTreeItem } from "./AzExtTreeItem";
import type { IAzExtParentTreeItemInternal } from "./InternalInterfaces";

/**
 * Using instanceof AzExtParentTreeItem causes issues since each extension has their own version of the utils. Instead, check _isAzExtParentTreeItem
 */
export function isAzExtParentTreeItem(maybeParentTreeItem: unknown): maybeParentTreeItem is AzExtParentTreeItem {
    return typeof maybeParentTreeItem === 'object' && (maybeParentTreeItem as IAzExtParentTreeItemInternal)._isAzExtParentTreeItem === true;
}

export function isAzExtTreeItem(maybeTreeItem: unknown): maybeTreeItem is AzExtTreeItem {
    return typeof maybeTreeItem === 'object' && (maybeTreeItem as AzExtTreeItem)._isAzExtTreeItem === true;
}
