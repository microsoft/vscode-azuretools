/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { AzExtParentTreeItem } from 'vscode-azureextensionui';
import { getIconPath } from './IconPath';

export abstract class SubscriptionTreeItemBase extends AzExtParentTreeItem implements types.SubscriptionTreeItemBase {
    public static readonly contextValue: string = 'azureextensionui.azureSubscription';
    public readonly contextValue: string = SubscriptionTreeItemBase.contextValue;
    public readonly label: string;

    public constructor(parent: AzExtParentTreeItem | undefined, subscription: types.ISubscriptionContext) {
        super(parent);
        this._subscription = subscription;
        this.label = subscription.subscriptionDisplayName;
        this.id = subscription.subscriptionPath;
        this.iconPath = getIconPath('azureSubscription');
    }
}
