/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { AzureSubscriptionProvider } from "../AzureSubscriptionProvider";
import type { AzureTenant } from "../AzureTenant";

/**
 * @returns list of tenants that VS Code doesn't have sessions for
 */
export async function getUnauthenticatedTenants(subscriptionProvider: AzureSubscriptionProvider): Promise<AzureTenant[]> {
    const tenants = await subscriptionProvider.getTenants();
    const unauthenticatedTenants: AzureTenant[] = [];
    for await (const tenant of tenants) {
        if (!await subscriptionProvider.isSignedIn(tenant.tenantId, tenant.account)) {
            unauthenticatedTenants.push(tenant);
        }
    }

    return unauthenticatedTenants;
}
