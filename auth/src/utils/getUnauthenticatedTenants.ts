/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type * as vscode from "vscode";
import type { AzureSubscriptionProvider } from "../AzureSubscriptionProvider";
import type { AzureTenant } from "../AzureTenant";

/**
 * @param subscriptionProvider The {@link AzureSubscriptionProvider} to use
 * @param account (Optional) The account to get unauthenticated tenants for
 * @returns list of tenants that VS Code doesn't have sessions for
 */
export async function getUnauthenticatedTenants(subscriptionProvider: AzureSubscriptionProvider, account?: vscode.AuthenticationSessionAccountInformation): Promise<AzureTenant[]> {
    const tenants = await subscriptionProvider.getTenants(account);
    const unauthenticatedTenants: AzureTenant[] = [];
    for await (const tenant of tenants) {
        if (!await subscriptionProvider.isSignedIn(tenant.tenantId, tenant.account)) {
            unauthenticatedTenants.push(tenant);
        }
    }

    return unauthenticatedTenants;
}
