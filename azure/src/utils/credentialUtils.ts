/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzExtServiceClientCredentials, ISubscriptionContext } from "@microsoft/vscode-azext-utils";
import { localize } from '../localize';
import { AzureSubscription } from '@microsoft/vscode-azext-utils/hostapi.v2';

// TODO move this to utils package
/**
 * Converts a VS Code authentication session to an Azure Track 1 & 2 compatible compatible credential.
 */
export function createCredential(getSession: (scopes?: string[]) => vscode.ProviderResult<vscode.AuthenticationSession>): AzExtServiceClientCredentials {
    return {
        getToken: async (scopes?: string | string[]) => {
            if (typeof scopes === 'string') {
                scopes = [scopes];
            }

            const session = await getSession(scopes);

            if (session) {
                return {
                    token: session.accessToken
                };
            } else {
                return null;
            }
        },
        signRequest: async () => {
            throw new Error((localize('signRequestError', 'Track 1 credentials are not (currently) supported.')));
        }
    };
}

// TODO move this to utils package
/**
 * Creates a subscription context from an Azure subscription.
 */
export function createSubscriptionContext(subscription: AzureSubscription): ISubscriptionContext {
    return {
        subscriptionDisplayName: subscription.name,
        subscriptionPath: subscription.subscriptionId,
        userId: '',
        ...subscription,
        credentials: createCredential(subscription.authentication.getSession)
    };
}
