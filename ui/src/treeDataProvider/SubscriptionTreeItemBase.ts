/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { AzureParentTreeItem } from './AzureParentTreeItem';
import { getIconPath } from './IconPath';

export abstract class SubscriptionTreeItemBase extends AzureParentTreeItem implements types.SubscriptionTreeItemBase {
    public static readonly contextValue: string = 'azureextensionui.azureSubscription';
    public readonly contextValue: string = SubscriptionTreeItemBase.contextValue;
    public readonly label: string;

    private _root: types.ISubscriptionContext;

    public constructor(parent: AzureParentTreeItem | undefined, root: types.ISubscriptionContext) {
        super(parent);
        this._root = root;
        this.label = root.subscriptionDisplayName;
        this.id = root.subscriptionPath;
        this.iconPath = getIconPath('azureSubscription');
    }

    public get root(): types.ISubscriptionContext {
        return this._root;
    }
}
