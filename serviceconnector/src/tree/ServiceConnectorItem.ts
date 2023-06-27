/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureResource, LinkerResource, TargetServiceBaseUnion } from "@azure/arm-servicelinker";
import { ISubscriptionContext, nonNullValue } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { ThemeIcon, TreeItem } from "vscode";
import { LinkerItem } from "../createLinker/createLinker";
import { getIconPath } from "./IconPath";
import { TreeElementBase } from "./ServiceConnectorGroupItem";


export interface ServiceConnectorItem extends TreeElementBase {
    linker: LinkerResource;
    subscription: ISubscriptionContext;
    item: LinkerItem;
}

export function createServiceConnectorItem(subscription: ISubscriptionContext, item: LinkerItem, linker: LinkerResource): ServiceConnectorItem {
    const id = `${item.id}/ServiceConnector/${linker.name}`;

    return {
        id,
        subscription,
        linker,
        item,
        viewProperties: {
            data: linker,
            label: `${item.id} ${vscode.l10n.t('linker', 'Linker')} ${linker.name}`,
        },
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
        }
    }

    return '';
}

function isAzureResource(targetResource: TargetServiceBaseUnion): targetResource is AzureResource {
    return 'id' in targetResource;
}

