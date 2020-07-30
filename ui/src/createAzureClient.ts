/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Environment } from '@azure/ms-rest-azure-env';
import { HttpOperationResponse, RequestPrepareOptions, ServiceClient, ServiceClientCredentials, WebResourceLike } from '@azure/ms-rest-js';
import * as vscode from "vscode";
import * as types from '../index';
import { appendExtensionUserAgent } from "./extensionUserAgent";

export function createAzureClient<T>(
    clientInfo: { credentials: ServiceClientCredentials; subscriptionId: string; environment: Environment; },
    clientType: new (credentials: ServiceClientCredentials, subscriptionId: string, options?: types.IMinimumServiceClientOptions) => T): T {
    return new clientType(clientInfo.credentials, clientInfo.subscriptionId, {
        acceptLanguage: vscode.env.language,
        baseUri: clientInfo.environment.resourceManagerEndpointUrl,
        userAgent: appendExtensionUserAgent
    });
}

export function createAzureSubscriptionClient<T>(
    clientInfo: { credentials: ServiceClientCredentials; environment: Environment; },
    clientType: new (credentials: ServiceClientCredentials, options?: types.IMinimumServiceClientOptions) => T): T {
    return new clientType(clientInfo.credentials, {
        acceptLanguage: vscode.env.language,
        baseUri: clientInfo.environment.resourceManagerEndpointUrl,
        userAgent: appendExtensionUserAgent
    });
}

export function createGenericClient(clientInfo?: ServiceClientCredentials | { credentials: ServiceClientCredentials; environment: Environment; }): ServiceClient {
    let credentials: ServiceClientCredentials | undefined;
    let baseUri: string | undefined;
    if (clientInfo && 'credentials' in clientInfo) {
        credentials = clientInfo.credentials;
        baseUri = clientInfo.environment.resourceManagerEndpointUrl;
    } else {
        credentials = clientInfo;
    }

    return new GenericServiceClient(credentials, <types.IMinimumServiceClientOptions>{
        baseUri,
        userAgent: appendExtensionUserAgent
    });
}

class GenericServiceClient extends ServiceClient {
    constructor(credentials: ServiceClientCredentials | undefined, options: types.IMinimumServiceClientOptions) {
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

        // tslint:disable-next-line: strict-boolean-expressions
        options.headers = options.headers || {};
        options.headers['accept-language'] = vscode.env.language;

        return await super.sendRequest(options);
    }
}
