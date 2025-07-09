/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { RoleDefinition } from "@azure/arm-authorization";
import { Identity } from "@azure/arm-msi";
import { AzExtParentTreeItem, AzExtTreeItem, createGenericElement, createSubscriptionContext, GenericTreeItem, IActionContext, ISubscriptionContext, TreeElementBase, TreeItemIconPath } from "@microsoft/vscode-azext-utils";
import { AzExtResourceType, AzureSubscription, getAzExtResourceType } from "@microsoft/vscode-azureresources-api";
import { ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import * as types from '../../index';
import { createAuthorizationManagementClient, createSubscriptionsClient } from "../clients";
import { createPortalUri } from "../utils/createPortalUri";
import { parseAzureResourceGroupId, parseAzureResourceId } from "../utils/parseAzureResourceId";
import { uiUtils } from "../utils/uiUtils";
import { getAzureIconPath } from "./IconPath";

export async function createRoleDefinitionsItems(context: IActionContext, subscription: AzureSubscription | ISubscriptionContext, msi: Identity): Promise<RoleDefinitionsItem[]> {
    const subContext = isAzureSubscription(subscription) ? createSubscriptionContext(subscription) : subscription;
    const authClient = await createAuthorizationManagementClient([context, subContext]);
    const roleAssignment = await uiUtils.listAllIterator(authClient.roleAssignments.listForSubscription());
    // filter the role assignments to only show the ones that are assigned to the msi
    const roleAssignments = roleAssignment.filter((ra) => ra.principalId === msi.principalId);

    const roleDefinitionsItems: RoleDefinitionsItem[] = [];
    await Promise.all(roleAssignments
        .map(async (ra) => {
            if (!ra.scope || !ra.roleDefinitionId) {
                return;
            }

            const roleDefinition = await authClient.roleDefinitions.getById(ra.roleDefinitionId);
            // if the role defition is not found, create a new one and push the role definition to it
            if (!roleDefinitionsItems.some((rdi) => rdi.id === ra.scope)) {
                const rdi = await RoleDefinitionsItem.createRoleDefinitionsItem({
                    context,
                    subContext,
                    roleDefinition,
                    scope: ra.scope,
                    msiId: msi.id,
                    // if the msi resource id doesn't contain the subscription id, it's from another subscription
                    withDescription: !msi.id?.includes(subContext.subscriptionId)
                });
                roleDefinitionsItems.push(rdi);
            } else {
                // if the role definition is found, add the role definition to the existing role definition item
                roleDefinitionsItems.find((rdi) => rdi.id === ra.scope)?.addRoleDefinition(roleDefinition);
            }
        }));

    return roleDefinitionsItems;
}

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
        subscription: AzureSubscription | ISubscriptionContext,
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
        options: {
            context: IActionContext,
            scope: string,
            roleDefinition: RoleDefinition,
            msiId: string | undefined,
            subContext: ISubscriptionContext,
            withDescription?: boolean
        }): Promise<RoleDefinitionsItem> {

        let parsedAzureResourceId: types.ParsedAzureResourceId | undefined;
        let parsedAzureResourceGroupId: types.ParsedAzureResourceGroupId | undefined;
        let label: string;
        let iconPath: TreeItemIconPath;
        let subscriptionId: string | undefined;
        const description: string | undefined = options.withDescription ? options.subContext.subscriptionDisplayName : undefined;

        try {
            parsedAzureResourceId = parseAzureResourceId(options.scope);
            subscriptionId = parsedAzureResourceId.subscriptionId;
            label = parsedAzureResourceId.resourceName;
            const resourceIconPath = getAzExtResourceType({ type: parsedAzureResourceId.provider });
            iconPath = resourceIconPath ? getAzureIconPath(resourceIconPath) : new ThemeIcon('symbol-field');
        }
        catch (error) {
            try {
                // if it's not a resource, then it's possibly a resource group or subscription
                parsedAzureResourceGroupId = parseAzureResourceGroupId(options.scope);
                subscriptionId = parsedAzureResourceGroupId.subscriptionId;
                label = parsedAzureResourceGroupId.resourceGroup;
                iconPath = getAzureIconPath(AzExtResourceType.ResourceGroup);
            } catch (error) {
                // if it's not a resource group, then it's a subscription
                subscriptionId = options.scope.split('/').pop() as string;
                const subClient = await createSubscriptionsClient([options.context, options.subContext]);
                try {
                    const subscription = await subClient.subscriptions.get(subscriptionId);
                    label = subscription.displayName as string;
                } catch (err) {
                    // no access to subscription, just display the id
                    label = subscriptionId;
                }
                iconPath = getAzureIconPath('Subscription');
            }
        }

        return new RoleDefinitionsItem({
            id: options.scope,
            label,
            iconPath,
            description,
            roleDefinition: options.roleDefinition,
            subscription: options.subContext,
            scope: options.scope
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
                // tooltip: rd.description,
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

// v1.5 implementation of RoleDefinitionsItem that uses RoleDefinitionsItem in the constructor
export class RoleDefinitionsTreeItem extends AzExtParentTreeItem {
    public label: string;
    public static contextValue: string = 'azureRoleDefinitions';
    public readonly contextValue: string = RoleDefinitionsTreeItem.contextValue;


    constructor(parent: AzExtParentTreeItem, readonly roleDefinitionsItem: RoleDefinitionsItem) {
        super(parent);
        this.id = roleDefinitionsItem.id;
        this.label = roleDefinitionsItem.label;
        this.iconPath = roleDefinitionsItem.iconPath;
        this.description = roleDefinitionsItem.description;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, _context: IActionContext): Promise<AzExtTreeItem[]> {
        return this.roleDefinitionsItem.roleDefintions.map((rd) => {
            return new GenericTreeItem(this, {
                label: "",
                id: `${this.id}/${rd.id}`,
                description: rd.roleName,
                tooltip: rd.description,
                contextValue: 'roleDefinition',
            });
        });
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}

function isAzureSubscription(subscription: ISubscriptionContext | AzureSubscription): subscription is AzureSubscription {
    return 'authentication' in subscription;
}
