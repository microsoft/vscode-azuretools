/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HttpOperationResponse, RequestPrepareOptions, ServiceClient, WebResourceLike } from '@azure/ms-rest-js';
import * as vscode from 'vscode';
import * as types from '../index';

export class GenericServiceClient extends ServiceClient {
    constructor(credentials: types.AzExtServiceClientCredentials | undefined, options: types.IMinimumServiceClientOptions) {
        super(credentials, options);
        this.baseUri = options.baseUri?.endsWith('/') ? options.baseUri.slice(0, -1) : options.baseUri;
    }

    public async sendRequest(options: RequestPrepareOptions | WebResourceLike): Promise<HttpOperationResponse> {
        if (this.baseUri && options.url && !options.url.startsWith('http')) {
            if (!options.url.startsWith('/')) {
                options.url = `/${options.url}`;
            }

            options.url = this.baseUri + options.url;
        }

        options.headers ||= {};
        options.headers['accept-language'] = vscode.env.language;

        return await super.sendRequest(options);
    }
}
