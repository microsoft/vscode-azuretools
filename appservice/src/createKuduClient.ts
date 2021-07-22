/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BasicAuthenticationCredentials, ServiceClientCredentials } from '@azure/ms-rest-js';
import { appendExtensionUserAgent, createGenericClient, IActionContext, parseError } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { localize } from './localize';
import { ParsedSite } from './SiteClient';
import { nonNullProp } from './utils/nonNull';

interface IInternalKuduActionContext extends IActionContext {
    _cachedKuduClient?: KuduClient;
}

/**
 * Our first preference is to use the subscription's token credentials, but some types of sites only work with the basic publishing credentials
 * We'll ping the site, catch an 'Unauthorized' error, get the publishing creds, ping with those creds, and use them going forward if they work
 * Finally, we'll cache the client on the action context to avoid re-doing these requests multiple times for one action
 */
export async function createKuduClient(context: IInternalKuduActionContext, site: ParsedSite): Promise<KuduClient> {
    if (!context._cachedKuduClient) {
        if (!site.kuduHostName) {
            throw new Error(localize('notSupportedLinux', 'This operation is not supported by this app service plan.'));
        }

        const clientOptions = { baseUri: site.kuduUrl, userAgent: appendExtensionUserAgent };

        let credentials = site.subscription.credentials;

        try {
            await pingKuduSite(context, site, site.subscription.credentials);
        } catch (error) {
            if (parseError(error).errorType.toLowerCase() === '401') {
                try {
                    const client = await site.createClient(context);
                    const user = await client.getWebAppPublishCredential();
                    const basicCreds = new BasicAuthenticationCredentials(nonNullProp(user, 'publishingUserName'), nonNullProp(user, 'publishingPassword'));
                    await pingKuduSite(context, site, basicCreds);
                    credentials = basicCreds;
                    context.telemetry.properties.usedPublishCreds = 'true';
                } catch (pubCredError) {
                    // Pub creds didn't work. Fall back to original credentials
                    context.telemetry.properties.pubCredError = parseError(pubCredError).message;
                }
            }
        }

        context._cachedKuduClient = new (await import('vscode-azurekudu')).KuduClient(credentials, clientOptions);
    }

    return context._cachedKuduClient;
}

async function pingKuduSite(context: IActionContext, site: ParsedSite, credentials: ServiceClientCredentials): Promise<void> {
    const client = await createGenericClient(context, credentials);
    await client.sendRequest({ method: 'HEAD', url: site.kuduUrl })
}
