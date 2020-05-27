/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse } from 'ms-rest';
import { Readable } from 'stream';
import { KuduClient } from 'vscode-azurekudu';
import { IFilesClient } from './IFilesClient';

/**
 * Overwrites or creates a file. The etag passed in may be `undefined` if the file is being created
 * Returns the latest etag of the updated file
 */
export async function putFile(client: IFilesClient, data: Readable | string, filePath: string, etag: string | undefined): Promise<string> {
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
    const options: {} = etag ? { customHeaders: { ['If-Match']: etag } } : {};
    const kuduClient: KuduClient = await client.getKuduClient();
    const result: HttpOperationResponse<{}> = await kuduClient.vfs.putItemWithHttpOperationResponse(stream, filePath, options);
    return <string>result.response.headers.etag;
}
