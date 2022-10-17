/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EnvironmentCredential } from "@azure/identity";
import type { TokenCredential } from "@azure/core-auth";

/**
 * Token that can be used to authenticate to Azure.
 *
 * Required environment variables:
 *   - `AZURE_TENANT_ID`: The Azure Active Directory tenant (directory) ID.
 *   - `AZURE_CLIENT_ID`: The client (application) ID of an App Registration in the tenant.
 *   - `AZURE_CLIENT_SECRET`: A client secret that was generated for the App Registration.
 */
export class TestCredentials extends EnvironmentCredential implements TokenCredential {

}
