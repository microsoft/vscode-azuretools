/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Environment } from '@azure/ms-rest-azure-env';

/**
 * The App Service OAuth2 audience for public Azure.
 * App ID: abfa0a7c-a6b6-4736-8310-5855508787cd
 */
const publicAppServiceScope: string = 'https://appservice.azure.com/.default';

/**
 * The App Service OAuth2 audience for Azure US Government (Fairfax).
 * App ID: 6a02c803-dafd-4136-b4c3-5a6f318b4714
 */
const fairfaxAppServiceScope: string = 'https://appservice.azure.us/.default';

/**
 * The environment name for Azure US Government as defined in @azure/ms-rest-azure-env.
 */
const usGovernmentEnvironmentName: string = 'AzureUSGovernment';

/**
 * Returns the OAuth2 scopes needed to authenticate against App Service (Kudu) endpoints
 * for the given Azure environment.
 *
 * App Service endpoints require tokens scoped to the App Service audience — NOT the ARM
 * management audience. Using ARM tokens for Kudu calls is deprecated and will break.
 *
 * - Public Azure:      https://appservice.azure.com/.default  (abfa0a7c-a6b6-4736-8310-5855508787cd)
 * - Fairfax (US Gov):  https://appservice.azure.us/.default   (6a02c803-dafd-4136-b4c3-5a6f318b4714)
 */
export function getAppServiceScopes(environment: Environment): string[] {
    if (environment.name === usGovernmentEnvironmentName) {
        return [fairfaxAppServiceScope];
    }
    return [publicAppServiceScope];
}
