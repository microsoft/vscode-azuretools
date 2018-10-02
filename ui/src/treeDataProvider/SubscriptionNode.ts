/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ISubscriptionRoot } from '../../index';
import * as types from '../../index';
import { RootTreeItem } from './RootNode';

// tslint:disable-next-line:export-name todo rename file after review
export abstract class SubscriptionTreeItem extends RootTreeItem<ISubscriptionRoot> implements types.SubscriptionTreeItem {
    public static readonly contextValue: string = 'azureextensionui.azureSubscription';
    public readonly contextValue: string = SubscriptionTreeItem.contextValue;
    public readonly label: string;

    public constructor(root: ISubscriptionRoot) {
        super(root);
        this.label = root.subscriptionDisplayName;
        this.id = root.subscriptionPath;
        this.iconPath = path.join(__filename, '..', '..', '..', '..', 'resources', 'azureSubscription.svg');
    }
}
