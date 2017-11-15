
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { IAzureTreeItem } from "../../index";
import { localize } from "../localize";

export class CreatingTreeItem implements IAzureTreeItem {
    public static contextValue: string = 'azureCreating';
    public readonly contextValue: string = CreatingTreeItem.contextValue;
    private readonly _label: string;
    constructor(label: string) {
        this._label = label;
    }

    public get id(): string {
        return CreatingTreeItem.contextValue + this._label;
    }

    public get label(): string {
        return localize('creatingNode', '{0} (Creating...)', this._label);
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'Loading.svg'),
            dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'Loading.svg')
        };
    }
}
