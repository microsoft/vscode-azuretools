/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { TenantIdDescription } from "@azure/arm-resources-subscriptions";
import * as vscode from "vscode";
import type { AzureSubscriptionProvider } from "../AzureSubscriptionProvider";
import { getConfiguredAuthProviderId } from "./configuredAzureEnv";

/**
 * @returns list of tenants that VS Code doesn't have sessions for
 */
export async function getUnauthenticatedTenants(subscriptionProvider: AzureSubscriptionProvider): Promise<TenantIdDescription[]> {
    const accounts = Array.from((await vscode.authentication.getAccounts(getConfiguredAuthProviderId()))).sort((a, b) => a.label.localeCompare(b.label));
    const unauthenticatedTenants: TenantIdDescription[] = [];

    for (const account of accounts) {
        const tenants = await subscriptionProvider.getTenants(account);
        for await (const tenant of tenants) {
            if (tenant) {
                if (!await subscriptionProvider.isSignedIn(tenant.tenantId, account)) {
                    unauthenticatedTenants.push(tenant);
                }
            }
        }
    }

    return unauthenticatedTenants;
}
