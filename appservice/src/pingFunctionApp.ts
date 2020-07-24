/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClient } from '@azure/ms-rest-js';
import { createGenericClient } from 'vscode-azureextensionui';
import { ISimplifiedSiteClient } from '.';
import { localize } from './localize';

export async function pingFunctionApp(siteClient: ISimplifiedSiteClient): Promise<void> {
    if (siteClient.listHostKeys) {
        const client: ServiceClient = createGenericClient();
        await client.sendRequest({
            method: 'GET',
            url: `${siteClient.defaultHostUrl}/admin/host/status`,
            headers: {
                'x-functions-key': (await siteClient.listHostKeys()).masterKey
            }
        });
    } else {
        throw Error(localize('listHostKeysNotSupported', 'Listing host keys is not supported.'));
    }
}
