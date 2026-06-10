/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { AzureAccount } from '../contracts/AzureAccount';
import type { AzureSubscriptionProvider } from '../contracts/AzureSubscriptionProvider';
import { signInToTenant as nextSignInToTenant } from '../next/utils/signInToTenant';

/**
 * Prompts user to select from a list of unauthenticated tenants.
 * Once selected, requests a new session from VS Code specifically for this tenant.
 *
 * @remarks This is a thin wrapper around the dependency-injected `./next` {@link nextSignInToTenant},
 * binding it to the real `vscode` namespace.
 */
export async function signInToTenant(subscriptionProvider: AzureSubscriptionProvider, account?: AzureAccount): Promise<void> {
    await nextSignInToTenant(vscode, subscriptionProvider, account);
}
