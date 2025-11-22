/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureSubscriptionProvider, TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';

/**
 * Prompts user to select from a list of unauthenticated tenants.
 * Once selected, requests a new session from VS Code specifially for this tenant.
 */
export async function signInToTenant(subscriptionProvider: AzureSubscriptionProvider, account?: AzureAccount): Promise<void> {
    const tenant = await pickTenant(subscriptionProvider, account);
    if (tenant) {
        await subscriptionProvider.signIn(tenant);
    }
}

async function pickTenant(subscriptionProvider: AzureSubscriptionProvider, account?: AzureAccount): Promise<TenantIdAndAccount | undefined> {
    const pick = await vscode.window.showQuickPick(getPicks(subscriptionProvider, account), {
        placeHolder: vscode.l10n.t('Select a Tenant (Directory) to Sign In To'),
        matchOnDescription: true, // allow searching by tenantId
        ignoreFocusOut: true,
    });
    return pick?.tenant;
}

interface TenantQuickPickItem extends vscode.QuickPickItem {
    tenant: TenantIdAndAccount;
}

async function getPicks(subscriptionProvider: AzureSubscriptionProvider, account?: AzureAccount): Promise<TenantQuickPickItem[]> {
    const unauthenticatedTenants: AzureTenant[] = [];
    const accounts = account ? [account] : await subscriptionProvider.getAccounts();

    for (const account of accounts) {
        unauthenticatedTenants.push(...await subscriptionProvider.getUnauthenticatedTenantsForAccount(account));
    }

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
