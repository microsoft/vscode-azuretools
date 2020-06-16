/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISimplifiedSiteClient } from '.';
import { localize } from './localize';
import { requestUtils } from './utils/requestUtils';

export async function pingFunctionApp(client: ISimplifiedSiteClient): Promise<void> {

    const url: string = `${client.defaultHostUrl}/admin/host/status`;
    const request: requestUtils.Request = await requestUtils.getDefaultRequest(url);
    if (client.listHostKeys) {
        request.headers['x-functions-key'] = (await client.listHostKeys()).masterKey;
        await requestUtils.sendRequest(request);
    } else {
        throw Error(localize('listHostKeysNotSupported', 'Listing host keys is not supported.'));
    }
}
