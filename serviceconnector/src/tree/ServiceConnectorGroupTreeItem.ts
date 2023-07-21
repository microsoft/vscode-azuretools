/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { uiUtils } from "@microsoft/vscode-azext-azureutils";
import { AzExtParentTreeItem, AzExtTreeItem, TreeItemIconPath, nonNullValue } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { getIconPath } from "./IconPath";
import { ServiceConnectorTreeItem } from "./ServiceConnectorTreeItem";

export class ServiceConnectorGroupTreeItem extends AzExtParentTreeItem {
    constructor(parent: AzExtParentTreeItem, public readonly resourceId: string) {
        super(parent);
    }

    public async loadMoreChildrenImpl(): Promise<AzExtTreeItem[]> {
        const client = new (await import('@azure/arm-servicelinker')).ServiceLinkerManagementClient(this.subscription.credentials);
        const linkers = (await uiUtils.listAllIterator(client.linker.list(nonNullValue(this.resourceId))));

        const children = await this.createTreeItemsWithErrorHandling(
            linkers,
            'invalidServiceConnector',
            l => {
                return new ServiceConnectorTreeItem(l, this, this.resourceId)
            },
            l => {
                return l.name;
            }
        );
        return children;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public get id(): string {
        return `${this.resourceId}/ServiceConnector`;
    }

    public get label(): string {
        return vscode.l10n.t('Service Connector');
    }

    public get iconPath(): TreeItemIconPath {
        return getIconPath('ServiceConnector');
    }

    public get contextValue(): string {
        return 'serviceConnectorGroupItem';
    }
}
