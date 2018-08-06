/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { User } from 'azure-arm-website/lib/models';
import { BasicAuthenticationCredentials } from 'ms-rest';
import { addExtensionUserAgent } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { ArgumentError } from './errors';
import { SiteClient } from './SiteClient';

export async function getKuduClient(client: SiteClient): Promise<KuduClient> {
    const user: User = await client.getWebAppPublishCredential();
    if (!user.publishingUserName || !user.publishingPassword) {
        throw new ArgumentError(user);
    }

    const cred: BasicAuthenticationCredentials = new BasicAuthenticationCredentials(user.publishingUserName, user.publishingPassword);

    const kuduClient: KuduClient = new KuduClient(cred, client.kuduUrl);
    addExtensionUserAgent(kuduClient);
    return kuduClient;
}
