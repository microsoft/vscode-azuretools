/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse } from 'ms-rest';
import { Readable } from 'stream';
import KuduClient from 'vscode-azurekudu';
import { getKuduClient } from './getKuduClient';
import { SiteClient } from './SiteClient';

/**
 * Returns the latest etag of the updated file
 */
export async function putFile(client: SiteClient, data: Readable | string, filePath: string, etag: string): Promise<string> {
    const kuduClient: KuduClient = await getKuduClient(client);
    let stream: Readable;
    if (typeof data === 'string') {
        stream = new Readable();
        stream._read = function (this: Readable): void {
            this.push(data);
            this.push(null);
        };
    } else {
        stream = data;
    }
    const result: HttpOperationResponse<{}> = await kuduClient.vfs.putItemWithHttpOperationResponse(stream, filePath, { customHeaders: { ['If-Match']: etag } });
    return <string>result.response.headers.etag;
}
