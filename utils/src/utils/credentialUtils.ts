/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureSubscription } from '@microsoft/vscode-azureresources-api';
import * as vscode from 'vscode';
import { AzExtServiceClientCredentials, ISubscriptionContext } from '../../index';
import { ext } from '../extensionVariables';

/**
 * Converts a VS Code authentication session to an Azure Track 1 & 2 compatible compatible credential.
 */
export function createCredential(getSession: (scopes?: string[], options?: any) => vscode.ProviderResult<vscode.AuthenticationSession>): AzExtServiceClientCredentials {
    return {
        getToken: async (scopes?: string | string[], options?: unknown) => {
            if (typeof scopes === 'string') {
                scopes = [scopes];
            }

            const session = await getSession(scopes, options);

            if (session) {
                return {
                    token: session.accessToken
                };
            } else {
                return null;
            }
        }
    };
}

/**
 * Creates a subscription context from an application subscription.
 */
export function createSubscriptionContext(subscription: AzureSubscription): ISubscriptionContext {
    return {
        subscriptionDisplayName: subscription.name,
        userId: '', // TODO
        subscriptionPath: subscription.subscriptionId,
        ...subscription,
        credentials: createCredential(subscription.authentication.getSession),
        createCredentialsForScopes: async (scopes: string[], options?: any) => {
            ext.outputChannel.appendLine(`utils: createCredentialsForScopes: scopes: ${scopes}, options: ${JSON.stringify(options)}`);
            // Have to use bind here because we need to pass a `getSessions` function with a `scopes` parameter to `createCredential`
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return createCredential(subscription.authentication.getSessionWithScopes.bind(subscription.authentication, scopes, options));
        }
    };
}
