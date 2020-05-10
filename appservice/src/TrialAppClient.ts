/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import { BasicAuthenticationCredentials, ServiceClientCredentials } from 'ms-rest';
import { addExtensionUserAgent } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { localize } from './localize';

export interface TrialAppMetadata {
    url: string;
    ibizaUrl: string;
    monacoUrl: string;
    contentDownloadUrl: string;
    gitUrl: string;
    bashGitUrl: string;
    timeLeft: number;
    AppService: string;
    IsRbacEnabled: boolean;
    templateName: string;
    isExtended: boolean;
    csmId: string;
    siteName: string;
    publishingUserName: string;
    publishingPassword: string;
    siteGuid: string;
    loginSession: string;
    hostName: string;
    scmHostName: string;
}
export class TrialAppClient {

    public isLinux: boolean;
    public metadata: TrialAppMetadata;
    public credentials: ServiceClientCredentials;
    constructor(username: string, password: string, metadata: TrialAppMetadata) {
        this.metadata = metadata;
        this.isLinux = true;
        this.credentials = new BasicAuthenticationCredentials(username, password);
    }
    public async getKuduClient(): Promise<KuduClient> {
        if (!this.metadata.scmHostName) {
            throw new Error(localize('notSupportedLinux', 'This operation is not supported by this app service plan.'));
        }

        const kuduClient: KuduClient = new KuduClient(this.credentials, `https://${this.metadata.scmHostName}`);
        addExtensionUserAgent(kuduClient);
        return kuduClient;
    }

    public async listApplicationSettings(): Promise<StringDictionary> {
        const kuduClient: KuduClient = await this.getKuduClient();
        return <StringDictionary>await kuduClient.settings.getAll();
    }

    public async updateApplicationSettings(appSettings: StringDictionary): Promise<StringDictionary> {
        const kuduClient: KuduClient = await this.getKuduClient();
        await kuduClient.settings.set(appSettings);
        return Promise.resolve(appSettings);
    }
}
