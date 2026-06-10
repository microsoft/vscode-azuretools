/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureSubscriptionProvider, TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';

/**
 * The injected VS Code dependencies needed to prompt the user to sign in to a tenant.
 *
 * @remarks The full `vscode` namespace import is assignable to this type, so callers may simply pass `vscode`.
 */
export interface SignInToTenantContext {
    /**
     * The VS Code `window` namespace, used to show the tenant quick pick.
     */
    readonly window: Pick<typeof vscode.window, 'showQuickPick'>;

    /**
     * The VS Code localization namespace, used to localize the quick pick placeholder.
     */
    readonly l10n: Pick<typeof vscode.l10n, 't'>;
}

/**
 * Prompts user to select from a list of unauthenticated tenants.
 * Once selected, requests a new session from VS Code specifically for this tenant.
 *
 * @param context The {@link SignInToTenantContext} providing the injected `window` and `l10n` namespaces.
 * @param subscriptionProvider The subscription provider used to list and sign in to tenants.
 * @param account (Optional) If provided, only tenants for this account are listed.
 */
export async function signInToTenant(context: SignInToTenantContext, subscriptionProvider: AzureSubscriptionProvider, account?: AzureAccount): Promise<void> {
    const tenant = await pickTenant(context, subscriptionProvider, account);
    if (tenant) {
        await subscriptionProvider.signIn(tenant);
    }
}

async function pickTenant(context: SignInToTenantContext, subscriptionProvider: AzureSubscriptionProvider, account?: AzureAccount): Promise<TenantIdAndAccount | undefined> {
    const pick = await context.window.showQuickPick(getPicks(subscriptionProvider, account), {
        placeHolder: context.l10n.t('Select a Tenant (Directory) to Sign In To'),
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

    const duplicateTenants = new Set<string | undefined>(
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
            description: `${tenant.tenantId}${isDuplicate(tenant.tenantId) ? ` (${tenant.account.label})` : ''}`,
            detail: tenant.defaultDomain ?? '',
            tenant,
        }));

    return picks;
}
