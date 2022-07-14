/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { localize } from "../localize";

export function parseAzureResourceId(id: string): types.ParsedAzureResourceId {
    const matches: RegExpMatchArray | null = id.match(/\/subscriptions\/(.*)\/resourceGroups\/(.*)\/providers\/(.*)\/(.*)/i);

    if (matches === null || matches.length < 3) {
        throw new Error(localize('InvalidResourceId', 'Invalid Azure Resource Id'));
    }

    return {
        rawId: id,
        subscriptionId: matches[1],
        resourceGroupId: matches[2],
        provider: matches[3],
        resourceName: matches[4]
    }
}
