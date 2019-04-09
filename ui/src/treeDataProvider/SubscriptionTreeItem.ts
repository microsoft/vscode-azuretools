/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../..';
import { treeUtils } from '../utils/treeUtils';
import { RootTreeItem } from './RootTreeItem';

export abstract class SubscriptionTreeItem extends RootTreeItem<types.ISubscriptionRoot> implements types.SubscriptionTreeItem {
    public static readonly contextValue: string = 'azureextensionui.azureSubscription';
    public readonly contextValue: string = SubscriptionTreeItem.contextValue;
    public readonly label: string;

    public constructor(root: types.ISubscriptionRoot) {
        super(root);
        this.label = root.subscriptionDisplayName;
        this.id = root.subscriptionPath;
        this.iconPath = treeUtils.getIconPath('azureSubscription');
    }
}
