/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfigResource, StringDictionary, User } from 'azure-arm-website/lib/models';
import { BasicAuthenticationCredentials, ServiceClientCredentials } from 'ms-rest';
import { addExtensionUserAgent } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { requestUtils } from './utils/requestUtils';

export interface ITrialAppMetadata {
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
    public get fullName(): string {
        return this.metadata.hostName;
    }

    public get kuduHostName(): string {
        return this.metadata.scmHostName;
    }

    public isLinux: boolean;
    public metadata: ITrialAppMetadata;
    public credentials: ServiceClientCredentials;

    constructor(username: string, password: string, metadata: ITrialAppMetadata) {
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

    public async deleteApplicationSetting(appSettings: StringDictionary, key: string): Promise<StringDictionary> {
        const requestUrl: string = `https://${this.metadata.scmHostName}/api/settings/${key}`;
        const request: requestUtils.Request = await requestUtils.getDefaultRequest(requestUrl, this.credentials, 'DELETE');

        request.headers = {
            'content-type': 'application/json'
        };

        request.auth = { username: this.metadata.publishingUserName, password: this.metadata.publishingPassword };

        try {
            await requestUtils.sendRequest<string>(request);

        } catch (error) {
            ext.outputChannel.appendLine(error);
            throw Error(error);
        }
        return Promise.resolve(appSettings);
    }

    public async renameApplicationSetting(appSettings: StringDictionary, oldKey: string, newKey: string): Promise<StringDictionary> {
        appSettings = await this.deleteApplicationSetting(appSettings, oldKey);
        appSettings = await this.updateApplicationSetting(appSettings, newKey);
        return Promise.resolve(appSettings);
    }

    public async getWebAppPublishCredential(): Promise<User> {
        return { publishingUserName: this.metadata.publishingUserName, publishingPassword: this.metadata.publishingPassword };
    }

    public async getSiteConfig(): Promise<SiteConfigResource> {
        return {};
    }

    public async updateApplicationSettings(appSettings: StringDictionary): Promise<StringDictionary> {

        Object.keys(appSettings).forEach(async (setting) => {
            appSettings = await this.updateApplicationSetting(appSettings, setting);
        });

        return Promise.resolve(appSettings);
    }

    public async updateApplicationSetting(appSettings: StringDictionary, key: string): Promise<StringDictionary> {
        const request: requestUtils.Request = await requestUtils.getDefaultRequest(`https://${this.metadata.scmHostName}/api/settings`, this.credentials, 'POST');

        request.headers = {
            'content-type': 'application/json'
        };

        request.auth = { username: this.metadata.publishingUserName, password: this.metadata.publishingPassword };

        const setting: StringDictionary = {};
        setting[key] = appSettings[key];
        request.body = JSON.stringify(setting);

        try {
            await requestUtils.sendRequest<string>(request);
        } catch (error) {
            ext.outputChannel.appendLine(error);
        }

        return Promise.resolve(appSettings);
    }
}
