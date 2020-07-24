/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import { createGenericClient, ISubscriptionContext } from 'vscode-azureextensionui';

/**
 * Temporary workaround because this isn't in azure sdk yet
 */
export async function listFunctionsSlot(subscription: ISubscriptionContext, id: string): Promise<WebSiteManagementModels.FunctionEnvelopeCollection> {
    const client: ServiceClient = createGenericClient(subscription);
    const response: HttpOperationResponse = await client.sendRequest({ method: 'GET', url: getUrlPath(id) });
    const rawResult: IRawFunctionEnvelopeCollection = <IRawFunctionEnvelopeCollection>response.parsedBody;
    const result: {}[] = rawResult.value.map(convertRawResource);
    // tslint:disable-next-line: no-any
    (<any>result).nextLink = convertPropertyValue(rawResult.nextLink);
    return result;
}

/**
 * Temporary workaround because this isn't in azure sdk yet
 */
export async function getFunctionSlot(subscription: ISubscriptionContext, id: string, functionName: string): Promise<WebSiteManagementModels.FunctionEnvelope> {
    const client: ServiceClient = createGenericClient(subscription);
    const response: HttpOperationResponse = await client.sendRequest({ method: 'GET', url: getUrlPath(id, functionName) });
    return convertRawResource(<IRawAzureResource>response.parsedBody);
}

/**
 * Temporary workaround because this isn't in azure sdk yet
 */
export async function deleteFunctionSlot(subscription: ISubscriptionContext, id: string, functionName: string): Promise<void> {
    const client: ServiceClient = createGenericClient(subscription);
    await client.sendRequest({ method: 'DELETE', url: getUrlPath(id, functionName) });
}

function getUrlPath(id: string, functionName?: string): string {
    return `${id}/functions${functionName ? '/' + functionName : ''}?api-version=2016-08-01`;
}

interface IRawFunctionEnvelopeCollection {
    value: IRawAzureResource[];
    nextLink: string | null;
}

interface IRawAzureResource {
    properties: { [key: string]: string };
    name: string;
    // tslint:disable-next-line: no-reserved-keywords
    type: string;
    id: string;
    location: string;
}

/**
 * Mimics what the azure sdk does under the covers to create the returned object
 */
function convertRawResource(resource: IRawAzureResource): { [key: string]: string | undefined } {
    const result: { [key: string]: string | undefined } = {};
    for (const key of Object.keys(resource.properties)) {
        result[convertPropertyName(key)] = convertPropertyValue(resource.properties[key]);
    }

    result.name = resource.name;
    result.id = resource.id;
    result.type = resource.type;
    result.location = resource.location;

    return result;
}

/**
 * Converts property name like "function_app_id" to "functionAppId"
 */
function convertPropertyName(name: string): string {
    // tslint:disable-next-line: no-constant-condition
    while (true) {
        const match: RegExpMatchArray | null = /_([a-z])/g.exec(name);
        if (match) {
            name = name.replace(match[0], match[1].toUpperCase());
        } else {
            return name;
        }
    }
}

/**
 * The azure sdk types all use undefined instead of null, so ensure we align with that
 */
function convertPropertyValue(value: string | null | undefined): string | undefined {
    return value === null ? undefined : value;
}
