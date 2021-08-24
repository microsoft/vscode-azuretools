/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseRequestPolicy, BasicAuthenticationCredentials, HttpOperationResponse, RequestPolicy, RequestPolicyFactory, RequestPolicyOptions, RestError, ServiceClient, TokenCredentials, WebResource, WebResourceLike } from '@azure/ms-rest-js';
import { Agent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { v4 as uuid } from 'uuid';
import * as vscode from "vscode";
import * as types from '../index';
import { appendExtensionUserAgent } from "./extensionUserAgent";
import { GenericServiceClient } from './GenericServiceClient';
import { localize } from './localize';
import { maskValue } from './masking';
import { parseError } from './parseError';
import { AzExtTreeItem } from './tree/AzExtTreeItem';
import { parseJson, removeBom } from './utils/parseJson';

export type InternalAzExtClientContext = types.ISubscriptionActionContext | [types.IActionContext, types.ISubscriptionContext | AzExtTreeItem];

export function parseClientContext(clientContext: InternalAzExtClientContext): types.ISubscriptionActionContext {
    if (Array.isArray(clientContext)) {
        const subscription = clientContext[1] instanceof AzExtTreeItem ? clientContext[1].subscription : clientContext[1];
        // Make sure to copy over just the subscription info and not any other extraneous properties
        return Object.assign(clientContext[0], {
            credentials: subscription.credentials,
            subscriptionDisplayName: subscription.subscriptionDisplayName,
            subscriptionId: subscription.subscriptionId,
            subscriptionPath: subscription.subscriptionPath,
            tenantId: subscription.tenantId,
            userId: subscription.userId,
            environment: subscription.environment,
            isCustomCloud: subscription.isCustomCloud
        });
    } else {
        return clientContext;
    }
}

export function createAzureClient<T>(clientContext: InternalAzExtClientContext, clientType: types.AzExtClientType<T>): T {
    const context = parseClientContext(clientContext);
    return new clientType(context.credentials, context.subscriptionId, {
        acceptLanguage: vscode.env.language,
        baseUri: context.environment.resourceManagerEndpointUrl,
        userAgent: appendExtensionUserAgent,
        requestPolicyFactories: (defaultFactories: RequestPolicyFactory[]) => addAzExtFactories(context, context.credentials, defaultFactories),
    });
}

export function createAzureSubscriptionClient<T>(clientContext: InternalAzExtClientContext, clientType: types.AzExtSubscriptionClientType<T>): T {
    const context = parseClientContext(clientContext);
    return new clientType(context.credentials, {
        acceptLanguage: vscode.env.language,
        baseUri: context.environment.resourceManagerEndpointUrl,
        userAgent: appendExtensionUserAgent,
        requestPolicyFactories: (defaultFactories: RequestPolicyFactory[]) => addAzExtFactories(context, context.credentials, defaultFactories),
    });
}

export async function sendRequestWithTimeout(context: types.IActionContext, options: types.AzExtRequestPrepareOptions, timeout: number, clientInfo: types.AzExtGenericClientInfo): Promise<HttpOperationResponse> {
    let request: WebResource = new WebResource();
    request = request.prepare(options);
    request.timeout = timeout;

    if (options.rejectUnauthorized !== undefined) {
        request.agentSettings = {
            http: new Agent(),
            https: new HttpsAgent({ rejectUnauthorized: options.rejectUnauthorized })
        }
    }

    const client: GenericServiceClient = await createGenericClient(context, clientInfo, { noRetryPolicy: true });
    return await client.sendRequest(request);
}

interface IGenericClientOptions {
    noRetryPolicy?: boolean;
}

export async function createGenericClient(context: types.IActionContext, clientInfo: types.AzExtGenericClientInfo, options?: IGenericClientOptions): Promise<ServiceClient> {
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
        requestPolicyFactories: (defaultFactories: RequestPolicyFactory[]) => addAzExtFactories(context, credentials, defaultFactories),
        noRetryPolicy: options?.noRetryPolicy
    });
}

function addAzExtFactories(context: types.IActionContext, credentials: types.AzExtServiceClientCredentials | undefined, defaultFactories: RequestPolicyFactory[]): RequestPolicyFactory[] {
    // NOTE: Factories at the end of the array are executed first, and we want these to happen before the deserialization factory
    defaultFactories.push(
        {
            create: (nextPolicy, options): RequestPolicy => new RemoveBOMPolicy(nextPolicy, options)
        },
        {
            create: (nextPolicy, options): RequestPolicy => new MissingContentTypePolicy(nextPolicy, options)
        },
        {
            create: (nextPolicy, options): RequestPolicy => new CorrelationIdPolicy(nextPolicy, options, context)
        }
    );

    // We want these to execute last
    defaultFactories.unshift(
        {
            create: (nextPolicy, options): RequestPolicy => new MaskCredentialsPolicy(nextPolicy, options, credentials)
        },
        {
            create: (nextPolicy, options): RequestPolicy => new StatusCodePolicy(nextPolicy, options)
        }
    );

    return defaultFactories;
}

const contentTypeName: string = 'Content-Type';

/**
 * Automatically add id to correlate our telemetry with the platform team's telemetry
 */
class CorrelationIdPolicy extends BaseRequestPolicy {
    private _context: types.IActionContext;
    constructor(nextPolicy: RequestPolicy, requestPolicyOptions: RequestPolicyOptions, context: types.IActionContext) {
        super(nextPolicy, requestPolicyOptions);
        this._context = context;
    }

    public async sendRequest(request: WebResourceLike): Promise<HttpOperationResponse> {
        const headerName = 'x-ms-correlation-request-id';
        const id: string = this._context.telemetry.properties[headerName] ||= uuid();
        request.headers.set(headerName, id);
        return await this._nextPolicy.sendRequest(request);
    }
}

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

/**
 * The Azure SDK will only throw errors for bad status codes if it has an "operationSpec", but none of our "generic" requests will have that
 */
class StatusCodePolicy extends BaseRequestPolicy {
    constructor(nextPolicy: RequestPolicy, requestPolicyOptions: RequestPolicyOptions) {
        super(nextPolicy, requestPolicyOptions);
    }

    public async sendRequest(request: WebResourceLike): Promise<HttpOperationResponse> {
        const response: HttpOperationResponse = await this._nextPolicy.sendRequest(request);
        if (!request.operationSpec && (response.status < 200 || response.status >= 300)) {
            const errorMessage: string = response.bodyAsText ?
                parseError(response.parsedBody || response.bodyAsText).message :
                localize('unexpectedStatusCode', 'Unexpected status code: {0}', response.status);
            throw new RestError(errorMessage, undefined, response.status, request, response, response.bodyAsText);
        } else {
            return response;
        }
    }
}

/**
 * In the highly unlikely event that a request error includes the original credentials used for the request,
 * this policy will make sure those credentials get masked in the error message
 */
class MaskCredentialsPolicy extends BaseRequestPolicy {
    private _credentials: types.AzExtServiceClientCredentials | undefined;
    constructor(nextPolicy: RequestPolicy, requestPolicyOptions: RequestPolicyOptions, credentials: types.AzExtServiceClientCredentials | undefined,) {
        super(nextPolicy, requestPolicyOptions);
        this._credentials = credentials;
    }

    public async sendRequest(request: WebResourceLike): Promise<HttpOperationResponse> {
        try {
            return await this._nextPolicy.sendRequest(request);
        } catch (error) {
            const pe = parseError(error);
            if (this._credentials) {
                const tokenOrPassword = (<Partial<TokenCredentials>>this._credentials).token || (<Partial<BasicAuthenticationCredentials>>this._credentials).password;

                const maskedMessage = maskValue(pe.message, tokenOrPassword);
                const maskedErrorType = maskValue(pe.errorType, tokenOrPassword);
                if (pe.message !== maskedMessage || pe.errorType !== maskedErrorType) {
                    throw Object.assign(new Error(maskedMessage), { code: maskedErrorType });
                }
            }

            throw error;
        }
    }
}
