/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { GetSubscriptionsFilter } from '../AzureSubscriptionProvider';

/**
 * Check if an object is a {@link GetSubscriptionsFilter} with a tenantId.
 */
export function isGetSubscriptionsTenantFilter(obj: unknown): obj is GetSubscriptionsFilter & { tenantId: string } {
    if (typeof obj === 'object' && !!obj && 'tenantId' in obj && typeof obj.tenantId === 'string' && !!obj.tenantId) {
        return true;
    }

    return false;
}

/**
 * Check if an object is a {@link GetSubscriptionsFilter} with an account.
 */
export function isGetSubscriptionsAccountFilter(obj: unknown): obj is GetSubscriptionsFilter & { account: vscode.AuthenticationSessionAccountInformation } {
    if (typeof obj === 'object' && !!obj && 'account' in obj && typeof obj.account === 'object' && !!obj.account) {
        return true;
    }

    return false;
}
