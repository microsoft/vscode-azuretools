/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse, RestError, ServiceClient } from '@azure/ms-rest-js';
import { createGenericClient } from '@microsoft/vscode-azext-azureutils';
import { IActionContext, IParsedError, parseError } from '@microsoft/vscode-azext-utils';
import * as retry from 'p-retry';
import * as path from 'path';
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

            /*
                * Related to issue: https://github.com/microsoft/vscode-azurefunctions/issues/3337
                Sometimes receive a 'BadGateway' or 'ServiceUnavailable' error on initial fetch, but consecutive re-fetching usually fixes the issue.
                Under these circumstances, we will attempt to do the call 3 times during warmup before throwing the error
            */
            const retries = 3;
            const badGateway: RegExp = /BadGateway/i;
            const serviceUnavailable: RegExp = /ServiceUnavailable/i;
            const client: ServiceClient = await createGenericClient(context, site.subscription);

            return await retry<HttpOperationResponse>(
                async () => {
                    try {
                        return await client.sendRequest({
                            method: 'GET',
                            url: `${site.id}/hostruntime/admin/vfs/${filePath}/?api-version=2018-11-01`
                        });
                    } catch (error) {
                        const parsedError: IParsedError = parseError(error);
                        if (!(badGateway.test(parsedError.message) || serviceUnavailable.test(parsedError.message))) {
                            throw new retry.AbortError(error);
                        }
                        throw error;
                    }
                },
                { retries, minTimeout: 10 * 1000 }
            );
        } else {
            const kuduClient = await createKuduClient(context, site);
            return (await kuduClient.vfs.getItem(filePath))._response;
        }
    } catch (error) {
        context.telemetry.maskEntireErrorMessage = true; // since the error could have the contents of the user's file
        throw error;
    }
}
