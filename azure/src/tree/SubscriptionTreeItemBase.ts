/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, ISubscriptionContext } from '@microsoft/vscode-azext-utils';
import { getIconPath } from './IconPath';

/**
 * Implement this class to display resources under a standard subscription tree item
 */
export abstract class SubscriptionTreeItemBase extends AzExtParentTreeItem {
    public static readonly contextValue: string = 'azureextensionui.azureSubscription';
    public readonly contextValue: string = SubscriptionTreeItemBase.contextValue;
    public readonly label: string;

    public constructor(parent: AzExtParentTreeItem | undefined, subscription: ISubscriptionContext) {
        super(parent);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this._subscription = subscription;
        this.label = subscription.subscriptionDisplayName;
        this.id = subscription.subscriptionPath;
        this.iconPath = getIconPath('azureSubscription');
    }
}
