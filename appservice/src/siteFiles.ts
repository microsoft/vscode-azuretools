/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse, RestError, ServiceClient } from '@azure/ms-rest-js';
import * as path from 'path';
import { createGenericClient, IActionContext } from 'vscode-azureextensionui';
import { createKuduClient } from './createKuduClient';
import { ParsedSite } from './SiteClient';

export interface ISiteFile {
    data: string;
    etag: string;
}

export interface ISiteFileMetadata {
    mime: string;
    name: string;
    path: string;
}

export async function getFile(context: IActionContext, site: ParsedSite, filePath: string): Promise<ISiteFile> {
    let response: HttpOperationResponse;
    try {
        response = await getFsResponse(context, site, filePath);
    } catch (error) {
        if (error instanceof RestError && error.code === 'PARSE_ERROR' && error.response?.status === 200) {
            // Some files incorrectly list the content-type as json and fail to parse, but we always just want the text itself
            response = error.response;
        } else {
            throw error;
        }
    }
    return { data: <string>response.bodyAsText, etag: <string>response.headers.get('etag') };
}

export async function listFiles(context: IActionContext, site: ParsedSite, filePath: string): Promise<ISiteFileMetadata[]> {
    const response: HttpOperationResponse = await getFsResponse(context, site, filePath);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Array.isArray(response.parsedBody) ? response.parsedBody : [];
}

/**
 * Overwrites or creates a file. The etag passed in may be `undefined` if the file is being created
 * Returns the latest etag of the updated file
 */
export async function putFile(context: IActionContext, site: ParsedSite, data: string | ArrayBuffer, filePath: string, etag: string | undefined): Promise<string> {
    const options: {} = etag ? { customHeaders: { ['If-Match']: etag } } : {};
    const kuduClient = await createKuduClient(context, site);
    const result: HttpOperationResponse = (await kuduClient.vfs.putItem(data, filePath, options))._response;
    return <string>result.headers.get('etag');
}

/**
 * Kudu APIs don't work for Linux consumption function apps and ARM APIs don't seem to work for web apps. We'll just have to use both
 */
async function getFsResponse(context: IActionContext, site: ParsedSite, filePath: string): Promise<HttpOperationResponse> {
    try {
        if (site.isFunctionApp) {
            const linuxHome: string = '/home';
            if (site.isLinux && !filePath.startsWith(linuxHome)) {
                filePath = path.posix.join(linuxHome, filePath);
            }

            const client: ServiceClient = await createGenericClient(context, site.subscription);
            return await client.sendRequest({
                method: 'GET',
                url: `${site.id}/hostruntime/admin/vfs/${filePath}?api-version=2018-11-01`
            });
        } else {
            const kuduClient = await createKuduClient(context, site);
            return (await kuduClient.vfs.getItem(filePath))._response;
        }
    } catch (error) {
        context.telemetry.maskEntireErrorMessage = true; // since the error could have the contents of the user's file
        throw error;
    }
}
