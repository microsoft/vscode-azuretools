/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { AzExtTreeItem } from './AzExtTreeItem';
import { IAzExtParentTreeItemInternal } from "./InternalInterfaces";

export class GenericTreeItem extends AzExtTreeItem implements types.GenericTreeItem {
    public readonly _isGenericTreeItem = true;
    public label: string;
    public contextValue: string;

    private _includeInTreeItemPicker: boolean;

    constructor(parent: IAzExtParentTreeItemInternal | undefined, options: types.IGenericTreeItemOptions) {
        super(parent);
        this.label = options.label;
        this.contextValue = options.contextValue;
        this.id = options.id;
        this.commandId = options.commandId;
        this.iconPath = options.iconPath;
        this.description = options.description;
        this._includeInTreeItemPicker = !!options.includeInTreeItemPicker;
    }

    public isAncestorOfImpl(): boolean {
        return this._includeInTreeItemPicker;
    }
}

export function isGenericTreeItem(item: unknown): item is GenericTreeItem {
    return (item as GenericTreeItem)._isGenericTreeItem;
}
