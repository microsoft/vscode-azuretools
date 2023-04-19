/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceClient } from '@azure/core-client';
import { createHttpHeaders, createPipelineRequest, defaultRetryPolicy, Pipeline, PipelineOptions, PipelinePolicy, PipelineRequest, PipelineResponse, RestError, RetryPolicyOptions, SendRequest, userAgentPolicy } from '@azure/core-rest-pipeline';
import { appendExtensionUserAgent, AzExtTreeItem, IActionContext, ISubscriptionActionContext, ISubscriptionContext, parseError } from '@microsoft/vscode-azext-utils';
import { Agent as HttpsAgent } from 'https';
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import * as types from '../index';
import { localize } from './localize';
import { parseJson, removeBom } from './utils/parseJson';

export type InternalAzExtClientContext = ISubscriptionActionContext | [IActionContext, ISubscriptionContext | AzExtTreeItem];

export function parseClientContext(clientContext: InternalAzExtClientContext): ISubscriptionActionContext {
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

export function createAzureClient<T extends ServiceClient>(clientContext: InternalAzExtClientContext, clientType: types.AzExtClientType<T>): T {
    const context = parseClientContext(clientContext);
    const client = new clientType(context.credentials, context.subscriptionId, {
        endpoint: context.environment.resourceManagerEndpointUrl,
    });

    addAzExtPipeline(context, client.pipeline);
    return client;
}

export function createAzureSubscriptionClient<T extends ServiceClient>(clientContext: InternalAzExtClientContext, clientType: types.AzExtSubscriptionClientType<T>): T {
    const context = parseClientContext(clientContext);
    const client = new clientType(context.credentials, {
        endpoint: context.environment.resourceManagerEndpointUrl
    });

    addAzExtPipeline(context, client.pipeline);
    return client;
}

export async function sendRequestWithTimeout(context: IActionContext, options: types.AzExtRequestPrepareOptions, timeout: number, clientInfo: types.AzExtGenericClientInfo): Promise<types.AzExtPipelineResponse> {
    const request: PipelineRequest = createPipelineRequest({
        ...options,
        timeout
    });

    if (options.rejectUnauthorized) {
        request.agent = new HttpsAgent({ rejectUnauthorized: options.rejectUnauthorized });
    }

    const client = await createGenericClient(context, clientInfo, { noRetryPolicy: true, addStatusCodePolicy: true });
    return await client.sendRequest(request);
}


export async function createGenericClient(context: IActionContext, clientInfo: types.AzExtGenericClientInfo | undefined, options?: types.IGenericClientOptions): Promise<ServiceClient> {
    let credentials: types.AzExtGenericCredentials | undefined;
    let endpoint: string | undefined;
    if (clientInfo && 'credentials' in clientInfo) {
        credentials = clientInfo.credentials;
        endpoint = clientInfo.environment.resourceManagerEndpointUrl;
    } else {
        credentials = clientInfo;
    }

    const retryOptions: RetryPolicyOptions | undefined = options?.noRetryPolicy ? { maxRetries: 0 } : undefined;

    const client = new ServiceClient({
        credential: credentials,
        endpoint
    });

    addAzExtPipeline(context, client.pipeline, endpoint, { retryOptions }, options?.addStatusCodePolicy);
    return client;
}

function addAzExtPipeline(context: IActionContext, pipeline: Pipeline, endpoint?: string, options?: PipelineOptions, addStatusCodePolicy?: boolean): Pipeline {
    // ServiceClient has default pipeline policies that the core-client SDKs require. Rather than building an entirely custom pipeline,
    // it's easier to just remove the default policies and add ours as-needed

    // ServiceClient adds a default retry policy, so we need to remove it and add ours
    if (options?.retryOptions) {
        pipeline.removePolicy(defaultRetryPolicy());
        pipeline.addPolicy(defaultRetryPolicy(options?.retryOptions));
    }

    // ServiceClient adds a default userAgent policy and you can't have duplicate policies, so we need to remove it and add ours
    pipeline.removePolicy(userAgentPolicy());
    pipeline.addPolicy(userAgentPolicy({ userAgentPrefix: appendExtensionUserAgent() }));

    // Policies to apply before the request
    pipeline.addPolicy(new AcceptLanguagePolicy(), { phase: 'Serialize' });
    if (vscode.env.isTelemetryEnabled) {
        pipeline.addPolicy(new CorrelationIdPolicy(context), { phase: 'Serialize' });
    }
    if (endpoint) {
        pipeline.addPolicy(new AddEndpointPolicy(endpoint), { phase: 'Serialize' });
    }

    // Policies to apply after the response
    pipeline.addPolicy(new MissingContentTypePolicy(), { phase: 'Deserialize' });
    pipeline.addPolicy(new RemoveBOMPolicy(), { phase: 'Deserialize', beforePolicies: [MissingContentTypePolicy.Name] });
    if (addStatusCodePolicy) {
        pipeline.addPolicy(new StatusCodePolicy() /*intentionally not in a phase*/);
    }

    return pipeline;
}

export function addBasicAuthenticationCredentialsToClient(client: ServiceClient, userName: string, password: string): void {
    client.pipeline.addPolicy(new BasicAuthenticationCredentialsPolicy(userName, password), { phase: 'Serialize' });
}

/**
 * Automatically add id to correlate our telemetry with the platform team's telemetry
 */
export class CorrelationIdPolicy implements PipelinePolicy {
    public readonly name = 'CorrelationIdPolicy';

    constructor(private readonly context: IActionContext) {
    }

    public async sendRequest(request: PipelineRequest, next: SendRequest): Promise<PipelineResponse> {
        const headerName = 'x-ms-correlation-request-id';
        const id: string = this.context.telemetry.properties[headerName] ||= uuidv4();
        request.headers.set(headerName, id);
        return await next(request);
    }
}

/**
 * Removes the BOM character if it exists in bodyAsText for a json response, to prevent a parse error
 */
class RemoveBOMPolicy implements PipelinePolicy {
    public readonly name = 'RemoveBOMPolicy';

    public async sendRequest(request: PipelineRequest, next: SendRequest): Promise<PipelineResponse> {
        const response: PipelineResponse = await next(request);
        const contentType: string | undefined = response.headers.get(contentTypeName);
        if (contentType && /json/i.test(contentType) && response.bodyAsText) {
            response.bodyAsText = removeBom(response.bodyAsText);
        }
        return response;
    }
}

const contentTypeName: string = 'Content-Type';

/**
 * The Azure SDK will assume "JSON" if no content-type is specified, which can cause false-positive parse errors.
 * This will be a little smarter and try to detect if it's json or generic data
 */
class MissingContentTypePolicy implements PipelinePolicy {
    public static readonly Name = 'MissingContentTypePolicy';
    public readonly name = MissingContentTypePolicy.Name;

    public async sendRequest(request: PipelineRequest, next: SendRequest): Promise<PipelineResponse> {
        const response: PipelineResponse = await next(request);
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

// Add the "Accept-Language" header
class AcceptLanguagePolicy implements PipelinePolicy {
    public readonly name = 'AcceptLanguagePolicy';

    public async sendRequest(request: PipelineRequest, next: SendRequest): Promise<PipelineResponse> {
        request.headers.set('Accept-Language', vscode.env.language);
        return await next(request);
    }
}

// Adds the endpoint to the request URL, if it is not present
class AddEndpointPolicy implements PipelinePolicy {
    public readonly name = 'AddEndpointPolicy';

    public constructor(private readonly endpoint: string) { }

    public async sendRequest(request: PipelineRequest, next: SendRequest): Promise<PipelineResponse> {
        if (this.endpoint && request.url && !request.url.startsWith('http')) {
            if (!request.url.startsWith('/')) {
                request.url = `/${request.url}`;
            }

            request.url = this.endpoint + request.url;
        }

        return await next(request);
    }
}

/**
 * When SDK calls error, they'll throw a RestError during the response.
 * However, with generic requests, it will pass any status code as a resolved response,
 * so check the status and throw our own RestError
 */
class StatusCodePolicy implements PipelinePolicy {
    public readonly name = 'StatusCodePolicy';

    public async sendRequest(request: PipelineRequest, next: SendRequest): Promise<types.AzExtPipelineResponse> {
        const response: types.AzExtPipelineResponse = await next(request);
        if (response.status < 200 || response.status >= 300) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const errorMessage: string = response.bodyAsText ?
                parseError(response.parsedBody || response.bodyAsText).message :
                localize('unexpectedStatusCode', 'Unexpected status code: {0}', response.status);
            throw new RestError(errorMessage, {
                code: response.bodyAsText || '',
                statusCode: response.status,
                request,
                response
            });
        } else {
            return response;
        }
    }
}


/**
 * Encodes userName and password and signs a request with the Authentication header.
 * Imitates BasicAuthenticationCredentials from ms-rest-js
 */
class BasicAuthenticationCredentialsPolicy implements PipelinePolicy {
    public static readonly Name = 'BasicAuthenticationCredentialsPolicy';
    public readonly name = BasicAuthenticationCredentialsPolicy.Name;

    public constructor(private readonly userName: string, private readonly password: string) { }

    public async sendRequest(request: PipelineRequest, next: SendRequest): Promise<PipelineResponse> {
        const credentials = `${this.userName}:${this.password}`;
        const DEFAULT_AUTHORIZATION_SCHEME = "Basic";
        const encodedCredentials = `${DEFAULT_AUTHORIZATION_SCHEME} ${Buffer.from(credentials).toString("base64")}`;
        if (!request.headers) request.headers = createHttpHeaders();
        request.headers.set("authorization", encodedCredentials);

        return await next(request);
    }
}
