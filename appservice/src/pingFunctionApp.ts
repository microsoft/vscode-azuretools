/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TokenCredentials, WebResource } from 'ms-rest';
import * as requestP from 'request-promise';
import { signRequest } from './signRequest';
import { SiteClient } from './SiteClient';

export async function pingFunctionApp(client: SiteClient): Promise<void> {
    const requestOptions: WebResource = new WebResource();
    const adminKey: string = await client.getFunctionsAdminToken();
    await signRequest(requestOptions, new TokenCredentials(adminKey));
    // tslint:disable-next-line:no-unsafe-any
    await requestP.get(`${client.defaultHostUrl}/admin/host/status`, requestOptions);
}
