/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IGenericTreeItemOptions, ISubscriptionRoot } from '../../index';
import * as types from '../../index';
import { AzExtTreeItem } from './AzExtTreeItem';
import { IAzExtParentTreeItemInternal } from "./InternalInterfaces";

export class GenericTreeItem<TRoot = ISubscriptionRoot> extends AzExtTreeItem<TRoot> implements types.GenericTreeItem<TRoot> {
    public label: string;
    public contextValue: string;
    constructor(parent: IAzExtParentTreeItemInternal<TRoot> | undefined, options: IGenericTreeItemOptions) {
        super(parent);
        this.label = options.label;
        this.contextValue = options.contextValue;
        this.id = options.id;
        this.commandId = options.commandId;
        this.iconPath = options.iconPath;
        this.description = options.description;
    }

    public isAncestorOfImpl(): boolean {
        // never display generic items in tree picker
        return false;
    }
}
