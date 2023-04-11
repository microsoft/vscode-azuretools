/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClient } from '@azure/core-client';
import { createHttpHeaders, createPipelineRequest } from '@azure/core-rest-pipeline';
import { createGenericClient } from '@microsoft/vscode-azext-azureutils';
import { IActionContext } from '@microsoft/vscode-azext-utils';
import { ParsedSite } from './SiteClient';

export async function pingFunctionApp(context: IActionContext, site: ParsedSite): Promise<void> {
    const client = await site.createClient(context);
    const genericClient: ServiceClient = await createGenericClient(context, undefined);
    const headers = createHttpHeaders({
        'x-functions-key': (await client.listHostKeys()).masterKey || ''
    });

    await genericClient.sendRequest(createPipelineRequest({
        method: 'GET',
        url: `${site.defaultHostUrl}/admin/host/status`,
        headers
    }));
}
