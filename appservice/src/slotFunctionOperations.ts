/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FunctionEnvelope, FunctionEnvelopeCollection } from 'azure-arm-website/lib/models';
import { ISubscriptionContext } from 'vscode-azureextensionui';
import { requestUtils } from './utils/requestUtils';

/**
 * Temporary workaround because this isn't in azure sdk yet
 */
export async function listFunctionsSlot(subscription: ISubscriptionContext, id: string): Promise<FunctionEnvelopeCollection> {
    const request: requestUtils.Request = await requestUtils.getDefaultAzureRequest(getUrlPath(id), subscription);
    const response: IRawFunctionEnvelopeCollection = <IRawFunctionEnvelopeCollection>JSON.parse(await requestUtils.sendRequest(request));
    const result: {}[] = response.value.map(convertRawResource);
    // tslint:disable-next-line: no-any
    (<any>result).nextLink = convertPropertyValue(response.nextLink);
    return result;
}

/**
 * Temporary workaround because this isn't in azure sdk yet
 */
export async function getFunctionSlot(subscription: ISubscriptionContext, id: string, functionName: string): Promise<FunctionEnvelope> {
    const request: requestUtils.Request = await requestUtils.getDefaultAzureRequest(getUrlPath(id, functionName), subscription);
    const response: IRawAzureResource = <IRawAzureResource>JSON.parse(await requestUtils.sendRequest(request));
    return convertRawResource(response);
}

/**
 * Temporary workaround because this isn't in azure sdk yet
 */
export async function deleteFunctionSlot(subscription: ISubscriptionContext, id: string, functionName: string): Promise<void> {
    const request: requestUtils.Request = await requestUtils.getDefaultAzureRequest(getUrlPath(id, functionName), subscription, 'DELETE');
    await requestUtils.sendRequest(request);
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
