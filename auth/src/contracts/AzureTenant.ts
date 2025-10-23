/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TenantIdDescription } from "@azure/arm-resources-subscriptions";
import type { AzureAccount } from "./AzureAccount";

/**
 * An Azure tenant associated with a specific account
 */
export interface AzureTenant extends TenantIdDescription {
    readonly account: AzureAccount;
    readonly tenantId: string; // Override to make required
}
