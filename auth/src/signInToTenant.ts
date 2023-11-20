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
        placeHolder: 'Select Directory to Sign In To', // TODO: localize
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
    const picks: TenantQuickPickItem[] = unauthenticatedTenants.map(tenant => ({
        label: tenant.displayName ?? '',
        description: tenant.tenantId ?? '',
        detail: tenant.defaultDomain ?? '',
        tenant,
    }));

    return picks;
}
