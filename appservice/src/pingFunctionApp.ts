/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteClient } from './SiteClient';
import { requestUtils } from './utils/requestUtils';

export async function pingFunctionApp(client: SiteClient): Promise<void> {
    const url: string = `${client.defaultHostUrl}/admin/host/status`;
    const request: requestUtils.Request = await requestUtils.getDefaultRequest(url);
    request.headers['x-functions-key'] = (await client.listHostKeys()).masterKey;
    await requestUtils.sendRequest(request);
}
