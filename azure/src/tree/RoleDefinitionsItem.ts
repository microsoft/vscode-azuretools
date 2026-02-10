/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { RoleDefinition } from "@azure/arm-authorization";
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

export async function createRoleDefinitionsItems(context: IActionContext, subscription: AzureSubscription | ISubscriptionContext, msi: Identity, parentResourceId: string): Promise<RoleDefinitionsItem[]> {
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
            const roleDefinitionsItem: RoleDefinitionsItem | undefined = roleDefinitionsItems.find((rdi) => rdi.id === RoleDefinitionsItem.getId(parentResourceId, msi.id, ra.scope));

            if (!roleDefinitionsItem) {
                // if the role definition is not found, create a new one and push the role definition to it
                const rdi = await RoleDefinitionsItem.createRoleDefinitionsItem({
                    context,
                    subContext,
                    roleDefinition,
                    parentResourceId,
                    scope: ra.scope,
                    msiId: msi.id,
                    // if the msi resource id doesn't contain the subscription id, it's from another subscription
                    withDescription: !msi.id?.includes(subContext.subscriptionId)
                });
                roleDefinitionsItems.push(rdi);
            } else {
                // if the role definition is found, add the role definition to the existing role definitions item
                roleDefinitionsItem.addRoleDefinition(roleDefinition);
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

    /**
     * Generates a unique tree item id for a `RoleDefinitionsItem`.
     * Combines the core parent resource id, managed identity id, and scope to ensure uniqueness.
     *
     * @param parentResourceId The fully qualified parent resource id (e.g. resource group, function app, container app, etc.)
     * @param msiId The fully qualified managed identity id
     * @param scope The fully qualified scope for the role assignment
     */
    public static getId(parentResourceId: string = '', msiId: string = '', scope: string = ''): string {
        const identityBase: string = msiId.split('/').at(-1) ?? '{msiId}';
        return `${parentResourceId}/identities/${identityBase}/scopes/${scope}`;
    }

    public static async createRoleDefinitionsItem(
        options: {
            context: IActionContext,
            scope: string,
            roleDefinition: RoleDefinition,
            msiId: string | undefined,
            parentResourceId: string,
            subContext: ISubscriptionContext,
            withDescription?: boolean
        }): Promise<RoleDefinitionsItem> {

        let parsedScopeId: types.ParsedAzureResourceId | undefined;
        let parsedAzureResourceGroupId: types.ParsedAzureResourceGroupId | undefined;
        let label: string;
        let iconPath: TreeItemIconPath;
        let subscriptionId: string | undefined;
        const description: string | undefined = options.withDescription ? options.subContext.subscriptionDisplayName : undefined;

        try {
            parsedScopeId = parseAzureResourceId(options.scope);
            subscriptionId = parsedScopeId.subscriptionId;
            label = this.getRoleDefinitionsResourceLabel(parsedScopeId);
            const resourceIconPath = getAzExtResourceType({ type: parsedScopeId.provider });
            iconPath = resourceIconPath ? getAzureIconPath(resourceIconPath) : new ThemeIcon('symbol-field');
        }
        catch {
            try {
                // if it's not a resource, then it's possibly a resource group or subscription
                parsedAzureResourceGroupId = parseAzureResourceGroupId(options.scope);
                subscriptionId = parsedAzureResourceGroupId.subscriptionId;
                label = parsedAzureResourceGroupId.resourceGroup;
                iconPath = getAzureIconPath(AzExtResourceType.ResourceGroup);
            } catch {
                // if it's not a resource group, then it's a subscription
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                subscriptionId = options.scope.split('/').pop()!;
                const subClient = await createSubscriptionsClient([options.context, options.subContext]);
                try {
                    const subscription = await subClient.subscriptions.get(subscriptionId);
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    label = subscription.displayName!;
                } catch {
                    // no access to subscription, just display the id
                    label = subscriptionId;
                }
                iconPath = getAzureIconPath('Subscription');
            }
        }

        return new RoleDefinitionsItem({
            id: RoleDefinitionsItem.getId(options.parentResourceId, options.msiId, options.scope),
            label,
            iconPath,
            description,
            roleDefinition: options.roleDefinition,
            subscription: options.subContext,
            scope: options.scope
        });
    }

    private static getRoleDefinitionsResourceLabel(parsedScopeId: types.ParsedAzureResourceId): string {
        const scopeId: string = parsedScopeId.rawId;

        if (parsedScopeId.provider.startsWith('Microsoft.DurableTask')) {
            // /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.DurableTask/schedulers/{schedulerName}/taskhubs/{taskHubName}
            // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
            const dtsTaskHubMatch = scopeId.match(/Microsoft\.DurableTask\/schedulers\/([^/]+)\/taskhubs\/([^/]+)$/i);
            if (dtsTaskHubMatch) {
                // {schedulerName}/{taskHubName}
                return `${dtsTaskHubMatch[1]}/${dtsTaskHubMatch[2]}`;
            }
        }

        return parsedScopeId.resourceName;
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            id: this.id,
            iconPath: this.iconPath,
            description: this.description,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
        };
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
        return Promise.resolve(this.roleDefinitionsItem.roleDefintions.map((rd) => {
            const roleAssignmentBase: string = rd.id?.split('/').at(-1) ?? '{roleAssignment}';
            return new GenericTreeItem(this, {
                label: "",
                id: `${this.id}/roleAssignments/${roleAssignmentBase}`,
                description: rd.roleName,
                tooltip: rd.description,
                contextValue: 'roleDefinition',
            });
        }));
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}

function isAzureSubscription(subscription: ISubscriptionContext | AzureSubscription): subscription is AzureSubscription {
    return 'authentication' in subscription;
}
