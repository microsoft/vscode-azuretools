/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { AuthenticationWwwAuthenticateRequest } from 'vscode';
import type { Environment } from '@azure/ms-rest-azure-env';
import type { IActionContext } from './actionContext';

/**
 * Loose type to use for T2 versions of Azure credentials.
 */
export type AzExtServiceClientCredentials = AzExtServiceClientCredentialsT2;

/**
 * Loose interface to allow for the use of different versions of Azure SDKs
 * Used specifically for T2 Azure SDKs
 */
export interface AzExtServiceClientCredentialsT2 {
    getToken(scopeOrListOrRequest?: string | string[] | AuthenticationWwwAuthenticateRequest, options?: any): Promise<any | null>;
}

/**
 * Information specific to the Subscription
 */
export interface ISubscriptionContext {
    credentials: AzExtServiceClientCredentials;
    createCredentialsForScopes: (scopeListOrRequest: string[] | AuthenticationWwwAuthenticateRequest) => Promise<AzExtServiceClientCredentials>;
    subscriptionDisplayName: string;
    subscriptionId: string;
    subscriptionPath: string;
    tenantId: string;
    userId: string;
    environment: Environment;
    isCustomCloud: boolean;
}

export type ISubscriptionActionContext = ISubscriptionContext & IActionContext;
