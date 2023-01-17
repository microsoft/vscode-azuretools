/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { nonNullValue } from "@microsoft/vscode-azext-utils";
import { AzureSubscription } from "@microsoft/vscode-azext-utils/hostapi.v2";
import { AzureSubscription as AzureAccountSubscription } from "../azure-account.api";

export function createAzureSubscription(subscription: AzureAccountSubscription): AzureSubscription {
    return {
        authentication: {
            getSession: async scopes => {
                const token = await subscription.session.credentials2.getToken(scopes ?? []);

                if (!token) {
                    return undefined;
                }

                return {
                    accessToken: token.token,
                    account: {
                        id: subscription.session.userId,
                        label: subscription.session.userId
                    },
                    id: 'microsoft',
                    scopes: scopes ?? []
                };
            }
        },
        name: nonNullValue(subscription.subscription.displayName),
        environment: subscription.session.environment,
        isCustomCloud: subscription.session.environment.name === 'AzureCustomCloud',
        subscriptionId: nonNullValue(subscription.subscription.subscriptionId),
        tenantId: subscription.session.tenantId
    };
}
