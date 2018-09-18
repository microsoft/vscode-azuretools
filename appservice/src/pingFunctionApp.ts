/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { functionsAdminRequest } from './functionsAdminRequest';
import { SiteClient } from './SiteClient';

export async function pingFunctionApp(client: SiteClient): Promise<void> {
    await functionsAdminRequest(client, 'host/status');
}
