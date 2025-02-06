/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AuthorizationManagementClient, RoleAssignment } from "@azure/arm-authorization";
import { Identity } from "@azure/arm-msi";
import { Subscription } from "@azure/arm-resources-subscriptions";
import { createCredential, createSubscriptionContext, IActionContext, TreeElementBase } from "@microsoft/vscode-azext-utils";
import { AzureSubscription } from "@microsoft/vscode-azureresources-api";
import { l10n, TreeItem, TreeItemCollapsibleState } from "vscode";
import { createAuthorizationManagementClient, createSubscriptionsClient } from "../clients";
import { uiUtils } from "../utils/uiUtils";
import { RoleDefinitionsItem } from "./RoleDefinitionsItem";

export class TargetServiceRoleAssignmentItem implements TreeElementBase {
    public id: string;
    public label: string = l10n.t('Target services');
    private _cachedChildren: TreeElementBase[] = [];
    private _cachedSubscriptions: Subscription[] = [];
    private _loadedAllSubscriptions; // this is to prevent the user from loading the subscriptions multiple times

    public contextValue: string = 'targetServiceRoleAssignmentItem';

    constructor(readonly subscription: AzureSubscription, readonly msi: Identity, children: TreeElementBase[], subscriptions: Subscription[]) {
        this.id = `${msi.id}/${this.label}`;
        this._cachedChildren = children;
        this._cachedSubscriptions = subscriptions;
        this._loadedAllSubscriptions = false;
    }

    public static async createTargetServiceRoleAssignmentItem(context: IActionContext, subscription: AzureSubscription, msi: Identity): Promise<TargetServiceRoleAssignmentItem> {
        const subContext = createSubscriptionContext(subscription);
        const authClient = await createAuthorizationManagementClient([context, subContext]);
        const roleAssignment = await uiUtils.listAllIterator(authClient.roleAssignments.listForSubscription());
        // filter the role assignments to only show the ones that are assigned to the msi
        const roleAssignments = roleAssignment.filter((ra) => ra.principalId === msi.principalId);
        const subClient = await createSubscriptionsClient([context, subContext]);
        const subscriptions = await uiUtils.listAllIterator(subClient.subscriptions.list());

        const roleDefinitionsItems: RoleDefinitionsItem[] = [];
        await Promise.all(roleAssignments
            .map(async (ra) => {
                if (!ra.scope || !ra.roleDefinitionId) {
                    return;
                }
                const scopeSplit = ra.scope.split('/');
                const name = scopeSplit.pop();

                if (name) {
                    const roleDefinition = await authClient.roleDefinitions.getById(ra.roleDefinitionId);
                    // if the role defition is not found, create a new one and push the role definition to it
                    if (!roleDefinitionsItems.some((rdi) => rdi.label === name)) {
                        const rdi = await RoleDefinitionsItem.createRoleDefinitionsItem(ra.scope, roleDefinition, msi.id, subscription, subscriptions);
                        roleDefinitionsItems.push(rdi);
                    } else {
                        // if the role definition is found, add the role definition to the existing role definition item
                        roleDefinitionsItems.find((rdi) => rdi.label === name)?.addRoleDefinition(roleDefinition);
                    }
                }
            }));

        return new TargetServiceRoleAssignmentItem(subscription, msi, roleDefinitionsItems, subscriptions);
    }

    getChildren(): TreeElementBase[] {
        return this._cachedChildren;
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            id: this.id,
            contextValue: this._loadedAllSubscriptions ? this.contextValue + 'allLoaded' : this.contextValue,
            collapsibleState: this._cachedChildren.length < 10 ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed,
        }
    }

    private async getRoleDefinitionsItems(context: IActionContext, roleAssignments: RoleAssignment[]): Promise<RoleDefinitionsItem[]> {
        const subContext = createSubscriptionContext(this.subscription);
        const authClient = await createAuthorizationManagementClient([context, subContext]);
        const roleDefinitionsItems: RoleDefinitionsItem[] = [];
        await Promise.allSettled(roleAssignments
            .map(async (ra) => {
                if (!ra.scope || !ra.roleDefinitionId) {
                    return;
                }
                const scopeSplit = ra.scope.split('/');
                const name = scopeSplit.pop();

                if (name) {
                    const roleDefinition = await authClient.roleDefinitions.getById(ra.roleDefinitionId);
                    // if the role defition is not found, create a new one and push the role definition to it
                    if (!roleDefinitionsItems.some((rdi) => rdi.label === name)) {
                        const rdi = await RoleDefinitionsItem.createRoleDefinitionsItem(ra.scope, roleDefinition, this.msi.id, this.subscription, this._cachedSubscriptions);
                        roleDefinitionsItems.push(rdi);
                    } else {
                        // if the role definition is found, add the role definition to the existing role definition item
                        roleDefinitionsItems.find((rdi) => rdi.label === name)?.addRoleDefinition(roleDefinition);
                    }
                }
            }));

        return roleDefinitionsItems;
    }

    async loadAllSubscriptionRoleAssignments(context: IActionContext) {
        // individual extensions are responsible for adding the command inline or in the context menu
        // extensions are also responsible for running it with a temporary description to show progress and refreshing the tree
        const roleAssignments: { [id: string]: RoleAssignment[] } = {};
        const credentials = createCredential(this.subscription.authentication.getSession);
        await Promise.allSettled(this._cachedSubscriptions.map(async (subscription) => {
            if (subscription.subscriptionId) {
                const authClient = new AuthorizationManagementClient(credentials, subscription.subscriptionId);
                roleAssignments[subscription.subscriptionId] = await uiUtils.listAllIterator(authClient.roleAssignments.listForSubscription());
            }
        }));

        const subscriptionRoleAssignments = Object.keys(roleAssignments);
        const filteredBySub = subscriptionRoleAssignments.map((subscription) => {
            return (roleAssignments)[subscription].filter((ra) => ra.principalId === this.msi.principalId)
        }).filter((ra) => ra.length > 0).flat();

        const allRoleDefinitions = await this.getRoleDefinitionsItems(context, filteredBySub);
        // don't add role definitions that are already there
        this._cachedChildren.push(...allRoleDefinitions.filter(rd => !this._cachedChildren.some(c => c.id === rd.id)));
        this._loadedAllSubscriptions = true;
    }
}
