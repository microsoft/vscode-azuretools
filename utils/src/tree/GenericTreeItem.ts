/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IGenericTreeItemOptions } from '../types/treeItem';
import { AzExtTreeItem } from './AzExtTreeItem';
import { IAzExtParentTreeItemInternal } from "./InternalInterfaces";

/**
 * A convenience class used for very basic tree items
 */
export class GenericTreeItem extends AzExtTreeItem {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public readonly _isGenericTreeItem = true;
    public label: string;
    public contextValue: string;

    private _includeInTreeItemPicker: boolean;

    constructor(parent: IAzExtParentTreeItemInternal | undefined, options: IGenericTreeItemOptions) {
        super(parent);
        this.label = options.label;
        this.contextValue = options.contextValue;
        this.id = options.id;
        this.commandId = options.commandId;
        this.iconPath = options.iconPath;
        this.description = options.description;
        this.tooltip = options.tooltip;
        this._includeInTreeItemPicker = !!options.includeInTreeItemPicker;
    }

    public isAncestorOfImpl(): boolean {
        return this._includeInTreeItemPicker;
    }
}

export function isGenericTreeItem(item: unknown): item is GenericTreeItem {
    return typeof item === 'object' && (item as GenericTreeItem)._isGenericTreeItem;
}
