/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TokenCredentials, WebResource } from 'ms-rest';
import * as requestP from 'request-promise';
import KuduClient from 'vscode-azurekudu';
import { getKuduClient } from './getKuduClient';
import { signRequest } from './signRequest';
import { SiteClient } from './SiteClient';

export async function pingFunctionApp(client: SiteClient): Promise<void> {
    const kuduClient: KuduClient = await getKuduClient(client);

    const requestOptions: WebResource = new WebResource();
    const adminKey: string = await kuduClient.functionModel.getAdminToken();
    await signRequest(requestOptions, new TokenCredentials(adminKey));
    // tslint:disable-next-line:no-unsafe-any
    await requestP.get(`${client.defaultHostUrl}/admin/host/status`, requestOptions);
}
