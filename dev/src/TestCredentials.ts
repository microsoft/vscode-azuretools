/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AccessToken, TokenCredential } from "@azure/core-auth";
import { ApplicationTokenCredentials } from '@azure/ms-rest-nodeauth';
import { TokenResponse } from "adal-node";

/**
 * Token that is forward compatible with track 2 Azure SDK for Node.js
 * `getToken: Promise<AccessToken>` is required for use with T2 Azure SDK, but doesn't
 * affect T1 SDKs as those require `signRequest`
 * `DeviceTokenCredentials` requires `getToken` to return `TokenResponse` so this overwrites that
 */
export class TestCredentials extends ApplicationTokenCredentials implements TokenCredential {
    public constructor( servicePrincipalCredentials: ApplicationTokenCredentials) {
        const { clientId, domain, secret, tokenAudience, environment, tokenCache } = servicePrincipalCredentials;
        super(clientId, domain, secret, tokenAudience, environment, tokenCache);
    }

    public async getToken(): Promise<AccessToken & TokenResponse> {
        const tokenResponse = await super.getToken();
        return Object.assign(tokenResponse, {
            token: tokenResponse.accessToken, 
            expiresOnTimestamp: new Date().getTime() + tokenResponse.expiresIn 
        });
    }
}
