/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { appendExtensionUserAgent } from "vscode-azureextensionui";
import { KuduClient } from "vscode-azurekudu";
import { localize } from "./localize";
import { SiteClient } from "./SiteClient";


export async function createKuduClient(siteClient: SiteClient): Promise<KuduClient> {
    if (!siteClient.kuduHostName) {
        throw new Error(localize('notSupportedLinux', 'This operation is not supported by this app service plan.'));
    }

    return new (await import('vscode-azurekudu')).KuduClient(siteClient.subscription.credentials, {
        baseUri: siteClient.kuduUrl,
        userAgent: appendExtensionUserAgent
    });
}
