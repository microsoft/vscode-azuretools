/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureAccount } from '../contracts/AzureAccount';
import { AzureTenant } from '../contracts/AzureTenant';

export function screen(accountOrTenant: AzureAccount | AzureTenant): string {
    if ('label' in accountOrTenant && typeof accountOrTenant.label === 'string') {
        const label = accountOrTenant.label;
        return label;

    } else if ('displayName' in accountOrTenant && typeof accountOrTenant.displayName === 'string') {
        const displayName = accountOrTenant.displayName;
        return displayName;
    } else {
        return 'unknown';
    }
}
