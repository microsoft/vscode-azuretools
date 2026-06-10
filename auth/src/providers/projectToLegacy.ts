/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { AzureAccount as NextAzureAccount } from '../next/contracts/AzureAccount';
import type { AzureSubscription as NextAzureSubscription } from '../next/contracts/AzureSubscription';
import type { AzureTenant as NextAzureTenant } from '../next/contracts/AzureTenant';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureAuthentication } from '../contracts/AzureAuthentication';
import type { AzureSubscription } from '../contracts/AzureSubscription';
import type { TenantIdAndAccount } from '../contracts/AzureSubscriptionProvider';
import type { AzureTenant } from '../contracts/AzureTenant';
import { getConfiguredAzureEnv } from '../utils/configuredAzureEnv';
import { isAuthenticationWwwAuthenticateRequest } from '../next/utils/isAuthenticationWwwAuthenticateRequest';
import { NotSignedInError } from '../utils/NotSignedInError';

/**
 * Projects a `./next` {@link NextAzureAccount} to the legacy `.` {@link AzureAccount} shape by attaching
 * the `@azure/ms-rest-azure-env`-based `ExtendedEnvironment` from the configured Azure cloud.
 */
export function projectAccount(account: NextAzureAccount): AzureAccount {
    return { ...account, environment: getConfiguredAzureEnv() };
}

/**
 * Projects a `./next` {@link NextAzureTenant} to the legacy `.` {@link AzureTenant} shape, re-associating
 * it with the given (already-projected) legacy account.
 */
export function projectTenant(tenant: NextAzureTenant, account: AzureAccount): AzureTenant {
    return { ...tenant, account };
}

/**
 * Projects a `./next` {@link NextAzureSubscription} to the legacy `.` {@link AzureSubscription} shape,
 * re-adding the per-subscription {@link AzureAuthentication} and the `ExtendedEnvironment` (with its
 * `isCustomCloud` flag) from the configured Azure cloud.
 */
export function projectSubscription(subscription: NextAzureSubscription, tenant: TenantIdAndAccount, authentication: AzureAuthentication): AzureSubscription {
    const environment = getConfiguredAzureEnv();
    return {
        authentication: authentication,
        environment: environment,
        isCustomCloud: environment.isCustomCloud,
        name: subscription.name,
        subscriptionId: subscription.subscriptionId,
        tenantId: subscription.tenantId,
        credential: subscription.credential,
        account: tenant.account,
    };
}

/**
 * The subset of the `./next` base's protected session primitives needed to build a legacy
 * {@link AzureAuthentication}. Legacy provider classes bind these from their own protected members.
 */
export interface LegacyAuthenticationPrimitives {
    getSession(scopeOrListOrRequest: string | string[] | vscode.AuthenticationWwwAuthenticateRequest | undefined, tenantId: string | undefined, options: vscode.AuthenticationGetSessionOptions): Promise<vscode.AuthenticationSession | undefined>;
    silenceRefreshEvents(): void;
    beginInteractiveRefreshSuppression(): void;
}

/**
 * Builds the legacy {@link AzureAuthentication} exposed on each legacy {@link AzureSubscription} for the
 * given account+tenant, using the provided session primitives. This is the single implementation shared by
 * the legacy base provider and the legacy VS Code provider.
 *
 * @param tenant The account+tenant to build authentication for.
 * @param primitives The bound session primitives from the owning provider.
 * @returns An {@link AzureAuthentication} for the given account+tenant.
 */
export function buildLegacyAuthentication(tenant: Partial<TenantIdAndAccount>, primitives: LegacyAuthenticationPrimitives): AzureAuthentication {
    return {
        getSession: async () => {
            primitives.silenceRefreshEvents();
            const session = await primitives.getSession(undefined, tenant.tenantId, { createIfNone: false, silent: true, account: tenant.account });
            if (!session) {
                throw new NotSignedInError();
            }
            return session;
        },
        getSessionWithScopes: async (scopeListOrRequest, options) => {
            // A challenge (e.g. an MFA step-up) must always be able to prompt so the user can satisfy
            // it. For a plain scope list we stay silent by default, but allow callers to opt in to an
            // interactive consent prompt via `options.createIfNone` (used, for example, to consent to
            // the App Service audience before a deployment).
            // See https://github.com/microsoft/vscode-azurefunctions/issues/5073
            const createIfNone = isAuthenticationWwwAuthenticateRequest(scopeListOrRequest) || !!options?.createIfNone;
            if (createIfNone) {
                // Interactive consent can take a while, so suppress without timeout until it is done,
                // then silence for a bit longer afterwards (same pattern as `signIn`).
                primitives.beginInteractiveRefreshSuppression();
            } else {
                primitives.silenceRefreshEvents();
            }
            const session = await primitives.getSession(scopeListOrRequest, tenant.tenantId, { ...(createIfNone ? { createIfNone: true } : { silent: true }), account: tenant.account });
            if (createIfNone) {
                primitives.silenceRefreshEvents();
            }
            if (!session) {
                throw new NotSignedInError();
            }
            return session;
        },
    };
}
