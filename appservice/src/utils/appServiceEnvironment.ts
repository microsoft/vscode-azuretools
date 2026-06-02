/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TokenCredential } from '@azure/core-auth';
import type { Environment } from '@azure/ms-rest-azure-env';
import type { ISubscriptionContext } from '@microsoft/vscode-azext-utils';

/**
 * App Service resource URLs by Azure environment name.
 */
const appServiceResourceUrls: Record<string, string> = {
    AzureUSGovernment: 'https://appservice.azure.us',
    AzureChinaCloud: 'https://appservice.azure.cn',
    AzureUSNat: 'https://appservice.azure.eaglex.ic.gov',
    AzureUSSec: 'https://appservice.azure.microsoft.scloud',
    AzureBleu: 'https://appservice.azure.sovcloud-api.fr',
    AzureDelos: 'https://appservice.azure.sovcloud-api.de',
};

const publicAppServiceResourceUrl: string = 'https://appservice.azure.com';

/**
 * Returns the OAuth2 scopes needed to authenticate against App Service (Kudu) endpoints
 * for the given Azure environment.
 *
 * App Service endpoints require tokens scoped to the App Service audience — NOT the ARM
 * management audience. Using ARM tokens for Kudu calls is deprecated and will break.
 *
 * The resource URL is environment-specific for sovereign clouds, so this mapping must stay
 * aligned with the supported Azure environments in auth.
 */
export function getAppServiceScopes(environment: Environment): string[] {
    const resourceUrl: string = appServiceResourceUrls[environment.name] ?? publicAppServiceResourceUrl;
    return [`${resourceUrl}/.default`];
}

/**
 * Minimal shape of the `authentication` object that the Azure Resources host spreads onto every
 * subscription context (see `createSubscriptionContext` in `@microsoft/vscode-azext-utils`).
 * Declared locally because this package does not depend on the resources API typings.
 */
interface SubscriptionAuthentication {
    // Optional because older hosts may provide an `authentication` object without this method.
    getSessionWithScopes?(scopeListOrRequest: string[], options?: { createIfNone?: boolean }): Promise<unknown>;
}

/**
 * Creates App Service auth context for the given subscription's cloud environment.
 * Returns both scopes and credentials so callers can avoid recomputing scopes.
 */
export async function getAppServiceCredentials(subscription: ISubscriptionContext): Promise<{ credentials: TokenCredential, scopes: string[] }> {
    const scopes: string[] = getAppServiceScopes(subscription.environment);

    // App Service (Kudu/SCM) endpoints require a token for the App Service audience, which the user
    // may not have consented to yet. Eagerly acquire a session here allowing an interactive prompt,
    // so the subsequent silent credential acquisition — and the Kudu operation itself — don't fail
    // with "You are not signed in to an Azure account". This is a one-time consent: once granted it
    // is cached and resolves silently on later calls. The method itself is optional-chained so we
    // degrade gracefully on older hosts whose `authentication` object predates `getSessionWithScopes`.
    // See https://github.com/microsoft/vscode-azurefunctions/issues/5073
    const authentication = (subscription as ISubscriptionContext & { authentication?: SubscriptionAuthentication }).authentication;
    await authentication?.getSessionWithScopes?.(scopes, { createIfNone: true });

    return {
        credentials: await subscription.createCredentialsForScopes(scopes) as TokenCredential,
        scopes,
    };
}
