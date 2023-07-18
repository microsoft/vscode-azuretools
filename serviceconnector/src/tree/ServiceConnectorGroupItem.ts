/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { uiUtils } from "@microsoft/vscode-azext-azureutils";
import { ISubscriptionContext, TreeElementBase, callWithTelemetryAndErrorHandling, createSubscriptionContext, nonNullValue } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { TreeItem, TreeItemCollapsibleState } from "vscode";
import { LinkerItem } from "../createLinker/createLinker";
import { getIconPath } from "./IconPath";
import { ServiceConnectorItem, createServiceConnectorItem } from "./ServiceConnectorItem";

export class ServiceConnectorGroupItem implements TreeElementBase {
    id: string = `${this.item.id}/ServiceConnector`;
    subscription: ISubscriptionContext;

    constructor(public readonly item: LinkerItem) {
        this.subscription = createSubscriptionContext(item.subscription);
    }

    async getChildren(): Promise<ServiceConnectorItem[]> {
        const result = await callWithTelemetryAndErrorHandling('getChildren', async () => {
            const client = new (await import('@azure/arm-servicelinker')).ServiceLinkerManagementClient(this.subscription.credentials);
            const linkers = (await uiUtils.listAllIterator(client.linker.list(nonNullValue(this.item.id))));
            return linkers.map(linker => createServiceConnectorItem(this.subscription, this.item, linker));
        });

        return nonNullValue(result);
    }

    getTreeItem(): TreeItem {
        return {
            id: this.id,
            label: vscode.l10n.t('Service Connector'),
            iconPath: getIconPath('ServiceConnector'),
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'serviceConnectorGroupItem'
        }
    }
}
