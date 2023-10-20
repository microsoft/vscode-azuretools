/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { TenantIdDescription } from "@azure/arm-subscriptions";
import type { AzureSubscriptionProvider } from "../AzureSubscriptionProvider";

/**
 * @returns list of tenants that VS Code doesn't have sessions for
 */
export async function getUnauthenticatedTenants(subscriptionProvider: AzureSubscriptionProvider): Promise<TenantIdDescription[]> {
    const tenants = await subscriptionProvider.getTenants();
    const unauthenticatedTenants: TenantIdDescription[] = [];
    for await (const tenant of tenants) {
        if (!await subscriptionProvider.isSignedIn(tenant.tenantId)) {
            unauthenticatedTenants.push(tenant);
        }
    }
    return unauthenticatedTenants;
}
