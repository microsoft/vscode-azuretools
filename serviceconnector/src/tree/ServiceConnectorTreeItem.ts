/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { LinkerResource } from "@azure/arm-servicelinker";
import { AzExtParentTreeItem, AzExtTreeItem, TreeItemIconPath, nonNullValue } from "@microsoft/vscode-azext-utils";
import { ThemeIcon } from "vscode";
import { getIconPath } from "./IconPath";
import { connectionIconPath } from "./ServiceConnectorItem";

export class ServiceConnectorTreeItem extends AzExtTreeItem {
    public readonly linker: LinkerResource;
    public readonly item: AzExtTreeItem;

    constructor(parent: AzExtParentTreeItem, linker: LinkerResource, item: AzExtTreeItem) {
        super(parent);
        this.linker = linker;
        this.item = item;
    }

    public get id(): string {
        return `${this.item.id}/ServiceConnector/${this.linker.name}`;
    }

    public get label(): string {
        return nonNullValue(this.linker.name);
    }

    public get contextValue(): string {
        return 'serviceConnectorItem';
    }

    public get iconPath(): TreeItemIconPath {
        return connectionIconPath(this.linker) === '' ? new ThemeIcon('dash') : getIconPath(connectionIconPath(this.linker))
    }
}
