/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Environment } from '@azure/ms-rest-azure-env';
import { BaseRequestPolicy, HttpOperationResponse, RequestPolicy, RequestPolicyFactory, RequestPolicyOptions, ServiceClient, WebResourceLike } from '@azure/ms-rest-js';
import * as vscode from "vscode";
import * as types from '../index';
import { appendExtensionUserAgent } from "./extensionUserAgent";
import { parseJson, removeBom } from './utils/parseJson';

export function createAzureClient<T>(
    clientInfo: { credentials: types.AzExtServiceClientCredentials; subscriptionId: string; environment: Environment; },
    clientType: new (credentials: types.AzExtServiceClientCredentials, subscriptionId: string, options?: types.IMinimumServiceClientOptions) => T): T {
    return new clientType(clientInfo.credentials, clientInfo.subscriptionId, {
        acceptLanguage: vscode.env.language,
        baseUri: clientInfo.environment.resourceManagerEndpointUrl,
        userAgent: appendExtensionUserAgent,
        requestPolicyFactories: addAzExtFactories
    });
}

export function createAzureSubscriptionClient<T>(
    clientInfo: { credentials: types.AzExtServiceClientCredentials; environment: Environment; },
    clientType: new (credentials: types.AzExtServiceClientCredentials, options?: types.IMinimumServiceClientOptions) => T): T {
    return new clientType(clientInfo.credentials, {
        acceptLanguage: vscode.env.language,
        baseUri: clientInfo.environment.resourceManagerEndpointUrl,
        userAgent: appendExtensionUserAgent,
        requestPolicyFactories: addAzExtFactories
    });
}

export async function createGenericClient(clientInfo?: types.AzExtServiceClientCredentials | { credentials: types.AzExtServiceClientCredentials; environment: Environment; }): Promise<ServiceClient> {
    let credentials: types.AzExtServiceClientCredentials | undefined;
    let baseUri: string | undefined;
    if (clientInfo && 'credentials' in clientInfo) {
        credentials = clientInfo.credentials;
        baseUri = clientInfo.environment.resourceManagerEndpointUrl;
    } else {
        credentials = clientInfo;
    }

    const gsc: typeof import('./GenericServiceClient') = await import('./GenericServiceClient');

    return new gsc.GenericServiceClient(credentials, <types.IMinimumServiceClientOptions>{
        baseUri,
        userAgent: appendExtensionUserAgent,
        requestPolicyFactories: addAzExtFactories
    });
}

function addAzExtFactories(defaultFactories: RequestPolicyFactory[]): RequestPolicyFactory[] {
    // NOTE: Factories at the end of the array are executed first, and we want these to happen before the deserialization factory
    defaultFactories.push(
        {
            create: (nextPolicy, options): RequestPolicy => new RemoveBOMPolicy(nextPolicy, options)
        },
        {
            create: (nextPolicy, options): RequestPolicy => new MissingContentTypePolicy(nextPolicy, options)
        }
    );
    return defaultFactories;
}

const contentTypeName: string = 'Content-Type';

/**
 * Removes the BOM character if it exists in bodyAsText for a json response, to prevent a parse error
 */
class RemoveBOMPolicy extends BaseRequestPolicy {
    constructor(nextPolicy: RequestPolicy, requestPolicyOptions: RequestPolicyOptions) {
        super(nextPolicy, requestPolicyOptions);
    }

    public async sendRequest(request: WebResourceLike): Promise<HttpOperationResponse> {
        const response: HttpOperationResponse = await this._nextPolicy.sendRequest(request);
        const contentType: string | undefined = response.headers.get(contentTypeName);
        if (contentType && /json/i.test(contentType) && response.bodyAsText) {
            response.bodyAsText = removeBom(response.bodyAsText);
        }
        return response;
    }
}

/**
 * The Azure SDK will assume "JSON" if no content-type is specified, which can cause false-positive parse errors.
 * This will be a little smarter and try to detect if it's json or generic data
 */
class MissingContentTypePolicy extends BaseRequestPolicy {
    constructor(nextPolicy: RequestPolicy, requestPolicyOptions: RequestPolicyOptions) {
        super(nextPolicy, requestPolicyOptions);
    }

    public async sendRequest(request: WebResourceLike): Promise<HttpOperationResponse> {
        const response: HttpOperationResponse = await this._nextPolicy.sendRequest(request);
        if (!response.headers.get(contentTypeName) && response.bodyAsText) {
            try {
                parseJson(response.bodyAsText);
                response.headers.set(contentTypeName, 'application/json');
            } catch {
                response.headers.set(contentTypeName, 'application/octet-stream');
            }
        }
        return response;
    }
}
