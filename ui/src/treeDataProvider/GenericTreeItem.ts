/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IGenericTreeItem, ISubscriptionRoot } from '../../index';
import * as types from '../../index';
import { AzureTreeItem } from './AzureNode';
import { IAzureParentTreeItemInternal } from "./InternalInterfaces";

export class GenericTreeItem<T = ISubscriptionRoot> extends AzureTreeItem<T> implements types.GenericTreeItem<T> {
    public label: string;
    public contextValue: string;
    constructor(parent: IAzureParentTreeItemInternal<T> | undefined, treeItem: IGenericTreeItem) {
        super(parent);
        this.label = treeItem.label;
        this.contextValue = treeItem.contextValue;
        this.id = treeItem.id;
        this.commandId = treeItem.commandId;
    }
}
