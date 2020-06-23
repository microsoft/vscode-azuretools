/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem } from '../treeDataProvider/AzExtTreeItem';
import { SubscriptionTreeItemBase } from '../treeDataProvider/SubscriptionTreeItemBase';

// tslint:disable-next-line:export-name
export function findSubscriptionTreeItem(node: AzExtTreeItem): SubscriptionTreeItemBase {
    let root: AzExtTreeItem = node;
    while (!(root instanceof SubscriptionTreeItemBase) && root.parent !== undefined) {
        root = root.parent;
    }

    if (root instanceof SubscriptionTreeItemBase) {
        return root;
    } else {
        throw Error('Root is not instanceof SubscriptionTreeItemBase');
    }
}
