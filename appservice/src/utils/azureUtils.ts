
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CheckNameAvailabilityResponse } from "@azure/arm-appservice";
import { HttpOperationResponse, ServiceClient } from "@azure/ms-rest-js";

export function areLocationNamesEqual(name1: string | undefined, name2: string | undefined): boolean {
    return normalizeLocationName(name1) === normalizeLocationName(name2);
}

function normalizeLocationName(name: string | undefined): string {
    return (name || '').toLowerCase().replace(/\s/g, '');
}

// temproray workaround for https://github.com/Azure/azure-sdk-for-js/issues/20728
export async function checkNameAvailability(client: ServiceClient, subscriptionId: string, name: string, type: 'Site' | 'Slot' ): Promise<CheckNameAvailabilityResponse> {
    const result: HttpOperationResponse = await client.sendRequest({
        method: 'POST',
        pathTemplate: `/subscriptions/{subscriptionId}/providers/Microsoft.Web/checknameavailability`,
        queryParameters: {
            'api-version': '2021-02-01',
        },
        pathParameters: {
            subscriptionId
        },
        body: {
            name, type
        }
    });

    return <CheckNameAvailabilityResponse>result.parsedBody;
}
