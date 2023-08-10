
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CheckNameAvailabilityResponse } from "@azure/arm-appservice";
import type { ServiceClient } from '@azure/core-client';
import { createHttpHeaders, createPipelineRequest } from "@azure/core-rest-pipeline";
import { AzExtPipelineResponse } from "@microsoft/vscode-azext-azureutils";

export function areLocationNamesEqual(name1: string | undefined, name2: string | undefined): boolean {
    return normalizeLocationName(name1) === normalizeLocationName(name2);
}

function normalizeLocationName(name: string | undefined): string {
    return (name || '').toLowerCase().replace(/\s/g, '');
}

// temporary workaround for https://github.com/Azure/azure-sdk-for-js/issues/20728
export async function checkNameAvailability(client: ServiceClient, subscriptionId: string, name: string, type: 'Site' | 'Slot'): Promise<CheckNameAvailabilityResponse> {
    const result: AzExtPipelineResponse = await client.sendRequest(createPipelineRequest({
        method: 'POST',
        url: `/subscriptions/${subscriptionId}/providers/Microsoft.Web/checknameavailability?api-version=2021-02-01`,
        headers: createHttpHeaders({
            'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
            name, type
        }),
    }));

    return <CheckNameAvailabilityResponse>result.parsedBody;
}
