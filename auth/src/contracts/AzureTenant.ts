/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzureTenant as NextAzureTenant } from '../next/contracts/AzureTenant';
import type { AzureAccount } from './AzureAccount';

/**
 * An Azure tenant associated with a specific account.
 *
 * @remarks Identical to the `./next` {@link NextAzureTenant}, except `account` is the legacy
 * {@link AzureAccount} (which exposes an `@azure/ms-rest-azure-env`-based environment).
 */
export interface AzureTenant extends Omit<NextAzureTenant, 'account'> {
    /**
     * The account associated with this tenant
     */
    readonly account: AzureAccount;
}