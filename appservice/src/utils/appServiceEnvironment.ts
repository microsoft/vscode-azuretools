/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Environment } from '@azure/ms-rest-azure-env';

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
