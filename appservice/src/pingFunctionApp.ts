/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClient } from '@azure/ms-rest-js';
import { createGenericClient, IActionContext } from 'vscode-azureextensionui';
import { ParsedSite } from './SiteClient';

export async function pingFunctionApp(context: IActionContext, site: ParsedSite): Promise<void> {
    const client = await site.createClient(context);
    const genericClient: ServiceClient = await createGenericClient(context, undefined);
    await genericClient.sendRequest({
        method: 'GET',
        url: `${site.defaultHostUrl}/admin/host/status`,
        headers: {
            'x-functions-key': (await client.listHostKeys()).masterKey
        }
    });
}
