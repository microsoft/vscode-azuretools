/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureResource, LinkerResource, TargetServiceBaseUnion } from "@azure/arm-servicelinker";
import { ISubscriptionContext, TreeElementBase, nonNullValue } from "@microsoft/vscode-azext-utils";
import { ThemeIcon, TreeItem } from "vscode";
import { LinkerItem } from "../createLinker/createLinker";
import { getIconPath } from "./IconPath";
import { getTreeId } from "./treeUtils";


export interface ServiceConnectorItem extends TreeElementBase {
    linker: LinkerResource;
    subscription: ISubscriptionContext;
    item: LinkerItem;
}

export function createServiceConnectorItem(subscription: ISubscriptionContext, item: LinkerItem, linker: LinkerResource): ServiceConnectorItem {
    const id = getTreeId(item, linker);

    return {
        id,
        subscription,
        linker,
        item,
        getTreeItem: (): TreeItem => ({
            id,
            label: linker.name,
            iconPath: connectionIconPath(linker) === '' ? new ThemeIcon('dash') : getIconPath(connectionIconPath(linker)),
            contextValue: 'serviceConnectorItem',
        }),
    };
}


export function connectionIconPath(linker: LinkerResource): string {
    const targetResource = nonNullValue(linker.targetService)
    if (isAzureResource(targetResource)) {
        const id: string = nonNullValue(targetResource.id)
        if (id.includes('Microsoft.Storage')) {
            return 'AzureStorageAccount';
        } else if (id.includes('Microsoft.DBforPostgreSQL')) {
            return 'PostgresServer';
        } else if (id.includes('Microsoft.DocumentDB')) {
            return 'CosmosDBAccount';
        } else if (id.includes('Microsoft.KeyVault')) {
            return 'KeyVault';
        }
    }

    return '';
}

function isAzureResource(targetResource: TargetServiceBaseUnion): targetResource is AzureResource {
    return 'id' in targetResource;
}

