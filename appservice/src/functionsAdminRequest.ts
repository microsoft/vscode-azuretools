/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TokenCredentials } from 'ms-rest';
import { SiteClient } from './SiteClient';
import { requestUtils } from './utils/requestUtils';

export async function functionsAdminRequest(client: SiteClient, urlPath: string): Promise<string> {
    const adminKey: string = await client.getFunctionsAdminToken();
    const url: string = `${client.defaultHostUrl}/admin/${urlPath}`;
    const request: requestUtils.Request = await requestUtils.getDefaultRequest(url, new TokenCredentials(adminKey));
    return await requestUtils.sendRequest(request);
}
