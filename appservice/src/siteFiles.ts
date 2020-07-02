/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse } from 'ms-rest';
import * as path from 'path';
import { Response } from 'request';
import { Readable } from 'stream';
import KuduClient from 'vscode-azurekudu';
import { ISimplifiedSiteClient } from './ISimplifiedSiteClient';
import { SiteClient } from './SiteClient';
import { requestUtils } from './utils/requestUtils';

export interface ISiteFile {
    data: string;
    etag: string;
}

export interface ISiteFileMetadata {
    mime: string;
    name: string;
    path: string;
}

export async function getFile(client: ISimplifiedSiteClient, filePath: string): Promise<ISiteFile> {
    const response: Response = await getFsResponse(client, filePath);
    return { data: <string>response.body, etag: <string>response.headers.etag };
}

export async function listFiles(client: ISimplifiedSiteClient, filePath: string): Promise<ISiteFileMetadata[]> {
    const response: Response = await getFsResponse(client, filePath);
    return <ISiteFileMetadata[]>JSON.parse(<string>response.body);
}

/**
 * Overwrites or creates a file. The etag passed in may be `undefined` if the file is being created
 * Returns the latest etag of the updated file
 */
export async function putFile(client: ISimplifiedSiteClient, data: Readable | string, filePath: string, etag: string | undefined): Promise<string> {
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

/**
 * Kudu APIs don't work for Linux consumption function apps and ARM APIs don't seem to work for web apps. We'll just have to use both
 */
async function getFsResponse(client: ISimplifiedSiteClient, filePath: string): Promise<Response> {
    if (client.isFunctionApp) {
        if (!(client instanceof SiteClient)) {
            throw new RangeError('Internal Error: Expected client to be of type SiteClient.');
        }

        const linuxHome: string = '/home';
        if (client.isLinux && !filePath.startsWith(linuxHome)) {
            filePath = path.posix.join(linuxHome, filePath);
        }

        const urlPath: string = `${client.id}/hostruntime/admin/vfs/${filePath}?api-version=2018-11-01`;
        const requestOptions: requestUtils.Request = await requestUtils.getDefaultAzureRequest(urlPath, client.subscription, 'GET');
        requestOptions.resolveWithFullResponse = true;
        return await requestUtils.sendRequest(requestOptions);
    } else {
        const kuduClient: KuduClient = await client.getKuduClient();
        return <Response>(await kuduClient.vfs.getItemWithHttpOperationResponse(filePath)).response;
    }
}
