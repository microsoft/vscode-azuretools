/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IGenericTreeItemOptions, ISubscriptionRoot } from '../../index';
import * as types from '../../index';
import { AzureTreeItem } from './AzureTreeItem';
import { IAzureParentTreeItemInternal } from "./InternalInterfaces";

export class GenericTreeItem<T = ISubscriptionRoot> extends AzureTreeItem<T> implements types.GenericTreeItem<T> {
    public label: string;
    public contextValue: string;
    constructor(parent: IAzureParentTreeItemInternal<T> | undefined, options: IGenericTreeItemOptions) {
        super(parent);
        this.label = options.label;
        this.contextValue = options.contextValue;
        this.id = options.id;
        this.commandId = options.commandId;
        this.iconPath = options.iconPath;
        this.description = options.description;
    }
}
