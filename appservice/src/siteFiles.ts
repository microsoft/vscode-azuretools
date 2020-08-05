/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import * as path from 'path';
import { Readable } from 'stream';
import { createGenericClient } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { ISimplifiedSiteClient } from './ISimplifiedSiteClient';
import { SiteClient } from './SiteClient';

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
    const response: HttpOperationResponse = await getFsResponse(client, filePath);
    return { data: <string>response.bodyAsText, etag: <string>response.headers.get('etag') };
}

export async function listFiles(client: ISimplifiedSiteClient, filePath: string): Promise<ISiteFileMetadata[]> {
    const response: HttpOperationResponse = await getFsResponse(client, filePath);
    return Array.isArray(response.parsedBody) ? response.parsedBody : [];
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
    const result: HttpOperationResponse = (await kuduClient.vfs.putItem(stream, filePath, options))._response;
    return <string>result.headers.get('etag');
}

/**
 * Kudu APIs don't work for Linux consumption function apps and ARM APIs don't seem to work for web apps. We'll just have to use both
 */
async function getFsResponse(siteClient: ISimplifiedSiteClient, filePath: string): Promise<HttpOperationResponse> {
    if (siteClient.isFunctionApp) {
        if (!(siteClient instanceof SiteClient)) {
            throw new RangeError('Internal Error: Expected client to be of type SiteClient.');
        }

        const linuxHome: string = '/home';
        if (siteClient.isLinux && !filePath.startsWith(linuxHome)) {
            filePath = path.posix.join(linuxHome, filePath);
        }

        const client: ServiceClient = createGenericClient(siteClient.subscription);
        return await client.sendRequest({
            method: 'GET',
            url: `${siteClient.id}/hostruntime/admin/vfs/${filePath}?api-version=2018-11-01`
        });
    } else {
        const kuduClient: KuduClient = await siteClient.getKuduClient();
        return (await kuduClient.vfs.getItem(filePath))._response;
    }
}
