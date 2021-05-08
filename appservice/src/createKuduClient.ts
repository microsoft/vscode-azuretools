/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "@azure/arm-appservice";
import { BasicAuthenticationCredentials } from "@azure/ms-rest-js";
import { appendExtensionUserAgent } from "vscode-azureextensionui";
import { KuduClient } from "vscode-azurekudu";
import { localize } from "./localize";
import { SiteClient } from "./SiteClient";
import { nonNullProp } from "./utils/nonNull";

export async function createKuduClient(siteClient: SiteClient): Promise<KuduClient> {
    if (!siteClient.kuduHostName) {
        throw new Error(localize('notSupportedLinux', 'This operation is not supported by this app service plan.'));
    }

    let credentials = siteClient.subscription.credentials;

    if (siteClient.kind?.includes('kubernetes')) {
        const publishCredentials: WebSiteManagementModels.User = await siteClient.getWebAppPublishCredential();
        const publishingPassword: string = nonNullProp(publishCredentials, 'publishingPassword');
        const publishingUserName: string = nonNullProp(publishCredentials, 'publishingUserName');
        credentials = new BasicAuthenticationCredentials(publishingUserName, publishingPassword);
    }

    return new (await import('vscode-azurekudu')).KuduClient(credentials, {
        baseUri: siteClient.kuduUrl,
        userAgent: appendExtensionUserAgent
    });
}
