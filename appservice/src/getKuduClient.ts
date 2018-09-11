/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, User } from 'azure-arm-website/lib/models';
import { BasicAuthenticationCredentials } from 'ms-rest';
import { addExtensionUserAgent } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { ArgumentError } from './errors';
import { localize } from './localize';
import { SiteClient } from './SiteClient';

export async function getKuduClient(client: SiteClient): Promise<KuduClient> {
    if (!client.kuduHostName) {
        const asp: AppServicePlan = await client.getAppServicePlan();
        const notSupportedLinux: string = localize('notSupportedLinux', 'This operation is not supported by App Service plans with kind "{0}" and sku tier "{1}".', client.kind, asp.sku.tier);
        throw new Error (notSupportedLinux);
    }
    const user: User = await client.getWebAppPublishCredential();
    if (!user.publishingUserName || !user.publishingPassword) {
        throw new ArgumentError(user);
    }

    const cred: BasicAuthenticationCredentials = new BasicAuthenticationCredentials(user.publishingUserName, user.publishingPassword);

    const kuduClient: KuduClient = new KuduClient(cred, client.kuduUrl);
    addExtensionUserAgent(kuduClient);
    return kuduClient;
}
