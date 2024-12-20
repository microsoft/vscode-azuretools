/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import type { TenantIdDescription } from "@azure/arm-resources-subscriptions";
import type { AzureSubscriptionProvider } from "./AzureSubscriptionProvider";
import { getUnauthenticatedTenants } from "./utils/getUnauthenticatedTenants";

/**
 * Prompts user to select from a list of unauthenticated tenants.
 * Once selected, requests a new session from VS Code specifially for this tenant.
 */
export async function signInToTenant(subscriptionProvider: AzureSubscriptionProvider): Promise<void> {
    const tenantId = await pickTenant(subscriptionProvider);
    if (tenantId) {
        await subscriptionProvider.signIn(tenantId);
    }
}

async function pickTenant(subscriptionProvider: AzureSubscriptionProvider): Promise<string | undefined> {
    const pick = await vscode.window.showQuickPick(getPicks(subscriptionProvider), {
        placeHolder: 'Select a Tenant (Directory) to Sign In To', // TODO: localize
        matchOnDescription: true, // allow searching by tenantId
        ignoreFocusOut: true,
    });
    return pick?.tenant.tenantId;
}

interface TenantQuickPickItem extends vscode.QuickPickItem {
    tenant: TenantIdDescription;
}

async function getPicks(subscriptionProvider: AzureSubscriptionProvider): Promise<TenantQuickPickItem[]> {
    const unauthenticatedTenants = await getUnauthenticatedTenants(subscriptionProvider);
    const duplicateTenants: Set<string | undefined> = new Set(
        unauthenticatedTenants
            .filter((tenant, index, self) => index !== self.findIndex(t => t.tenantId === tenant.tenantId))
            .map(tenant => tenant.tenantId)
    );
    const isDuplicate = (tenantId: string) => duplicateTenants.has(tenantId);

    const picks: TenantQuickPickItem[] = unauthenticatedTenants
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        .sort((a, b) => (a.displayName!).localeCompare(b.displayName!))
        .map(tenant => ({
            label: tenant.displayName ?? '',
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            description: `${tenant.tenantId!}${isDuplicate(tenant.tenantId!) ? ` (${tenant.account.label})` : ''}`,
            detail: tenant.defaultDomain ?? '',
            tenant,
        }));

    return picks;
}
