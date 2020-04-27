/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { AzExtTreeItem } from './AzExtTreeItem';
import { IAzExtParentTreeItemInternal } from "./InternalInterfaces";

export class GenericTreeItem extends AzExtTreeItem implements types.GenericTreeItem {
    public label: string;
    public contextValue: types.IContextValue;

    private _includeInTreeItemPicker: boolean;

    constructor(parent: IAzExtParentTreeItemInternal | undefined, options: types.IGenericTreeItemOptions) {
        super(parent);
        this.label = options.label;
        this.contextValue = { id: options.contextValue };
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
