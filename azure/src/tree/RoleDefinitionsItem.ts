/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { RoleDefinition } from "@azure/arm-authorization";
import { Subscription } from "@azure/arm-resources-subscriptions";
import { createGenericElement, TreeElementBase, TreeItemIconPath } from "@microsoft/vscode-azext-utils";
import { AzExtResourceType, AzureSubscription, getAzExtResourceType } from "@microsoft/vscode-azureresources-api";
import { ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { ParsedAzureResourceGroupId, ParsedAzureResourceId } from "../..";
import { createPortalUri } from "../utils/createPortalUri";
import { parseAzureResourceGroupId, parseAzureResourceId } from "../utils/parseAzureResourceId";
import { getAzureIconPath } from "./IconPath";

export class RoleDefinitionsItem implements TreeElementBase {
    public id: string;
    public label: string;
    public iconPath: TreeItemIconPath;
    public description: string | undefined;
    public roleDefintions: RoleDefinition[] = [];
    public readonly portalUrl: Uri;

    constructor(options: {
        label: string,
        id: string,
        iconPath: TreeItemIconPath,
        description: string | undefined,
        roleDefinition: RoleDefinition,
        subscription: AzureSubscription,
        scope: string
    }) {
        this.label = options.label;
        this.id = options.id;
        this.iconPath = options.iconPath;
        this.roleDefintions.push(options.roleDefinition);
        this.description = options.description;
        this.portalUrl = createPortalUri(options.subscription, options.scope);
    }

    public static async createRoleDefinitionsItem(
        scope: string,
        roleDefinition: RoleDefinition,
        msiId: string | undefined,
        subscription: AzureSubscription,
        allSubscriptions: Subscription[]): Promise<RoleDefinitionsItem> {

        let parsedAzureResourceId: ParsedAzureResourceId | undefined;
        let parsedAzureResourceGroupId: ParsedAzureResourceGroupId | undefined;
        let label: string;
        let iconPath: TreeItemIconPath;
        let subscriptionId: string | undefined;
        let description: string | undefined;
        let fromOtherSub = false;

        try {
            parsedAzureResourceId = parseAzureResourceId(scope);
            subscriptionId = parsedAzureResourceId.subscriptionId;
            label = parsedAzureResourceId.resourceName;
            const resourceIconPath = getAzExtResourceType({ type: parsedAzureResourceId.provider });
            iconPath = resourceIconPath ? getAzureIconPath(resourceIconPath) : new ThemeIcon('symbol-field');
        }
        catch (error) {
            try {
                // if it's not a resource, then it's possibly a resource group or subscription
                parsedAzureResourceGroupId = parseAzureResourceGroupId(scope);
                subscriptionId = parsedAzureResourceGroupId.subscriptionId;
                label = parsedAzureResourceGroupId.resourceGroup;
                iconPath = getAzureIconPath(AzExtResourceType.ResourceGroup);
            } catch (error) {
                // if it's not a resource group, then it's a subscription
                subscriptionId = scope.split('/').pop();

                label = allSubscriptions.find(s => s.subscriptionId === subscriptionId)?.displayName ?? scope;
                iconPath = getAzureIconPath('Subscription');
            }
        }

        fromOtherSub = subscriptionId !== subscription.subscriptionId;
        if (fromOtherSub) {
            // look for display name if it's from another subscription
            description = allSubscriptions.find(s => s.subscriptionId === (parsedAzureResourceGroupId?.subscriptionId ?? parsedAzureResourceId?.subscriptionId))?.displayName;
        }

        return new RoleDefinitionsItem({
            id: `${msiId}/${scope}`,
            label,
            iconPath,
            description,
            roleDefinition,
            subscription,
            scope
        });
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            id: this.id,
            iconPath: this.iconPath,
            description: this.description,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
        }
    }

    getChildren(): TreeElementBase[] {
        return this.roleDefintions.map((rd) => {
            return createGenericElement({
                label: "",
                id: `${this.id}/${rd.id}`,
                description: rd.roleName,
                tooltip: rd.description,
                contextValue: 'roleDefinition',
            });
        });
    }

    addRoleDefinition(roleDefinition: RoleDefinition): void {
        if (!this.roleDefintions.some((rd) => rd.roleName === roleDefinition.roleName)) {
            this.roleDefintions.push(roleDefinition);
        }
    }
}
