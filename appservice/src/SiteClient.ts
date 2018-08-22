/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from 'azure-arm-website';
import { AppServicePlan, HostNameSslState, Site, SiteConfigResource, SiteLogsConfig, SiteSourceControl, SourceControlCollection, StringDictionary, User, WebAppInstanceCollection } from 'azure-arm-website/lib/models';
import { addExtensionUserAgent, IAzureNode } from 'vscode-azureextensionui';
import { ArgumentError } from './errors';

/**
 * Wrapper of a WebSiteManagementClient for use with a specific Site
 * Reduces the number of arguments needed for every call and automatically ensures the 'slot' method is called when appropriate
 */
export class SiteClient {
    public readonly id: string;
    public readonly isSlot: boolean;
    /**
     * The main site name (does not include the slot name)
     */
    public readonly siteName: string;
    public readonly slotName?: string;
    /**
     * Combination of the site name and slot name (if applicable), separated by a hyphen
     */
    public readonly fullName: string;

    public readonly resourceGroup: string;
    public readonly location: string;
    public readonly serverFarmId: string;
    public readonly kind: string;
    public readonly initialState: string;
    public readonly isFunctionApp: boolean;

    public readonly planResourceGroup: string;
    public readonly planName: string;

    public readonly defaultHostName: string;
    public readonly defaultHostUrl: string;
    public readonly kuduHostName: string;
    public readonly kuduUrl: string;
    public readonly gitUrl: string;

    private readonly _node: IAzureNode;

    constructor(site: Site, node: IAzureNode) {
        const matches: RegExpMatchArray | null = site.serverFarmId.match(/\/subscriptions\/(.*)\/resourceGroups\/(.*)\/providers\/Microsoft.Web\/serverfarms\/(.*)/);
        if (!site.id || !site.name || !site.resourceGroup || !site.type || !site.defaultHostName || matches === null || matches.length < 4) {
            throw new ArgumentError(site);
        }

        this.isSlot = site.type.toLowerCase() === 'microsoft.web/sites/slots';
        this.id = site.id;
        [this.siteName, this.slotName] = this.isSlot ? site.name.split('/') : [site.name, undefined];
        this.fullName = this.siteName + (this.isSlot ? `-${this.slotName}` : '');

        this.resourceGroup = site.resourceGroup;
        this.location = site.location;
        this.serverFarmId = site.serverFarmId;
        this.kind = site.kind;
        this.initialState = site.state;
        this.isFunctionApp = site.kind && site.kind.includes('functionapp');

        this.planResourceGroup = matches[2];
        this.planName = matches[3];

        this.defaultHostName = site.defaultHostName;
        this.defaultHostUrl = `https://${this.defaultHostName}`;
        this.kuduHostName = site.hostNameSslStates.find((h: HostNameSslState) => h.hostType && h.hostType.toLowerCase() === 'repository').name;
        this.kuduUrl = `https://${this.kuduHostName}`;
        this.gitUrl = `${this.kuduHostName}:443/${site.repositorySiteName}.git`;

        this._node = node;
    }

    private get _client(): WebSiteManagementClient {
        const client: WebSiteManagementClient = new WebSiteManagementClient(this._node.credentials, this._node.subscriptionId, this._node.environment.resourceManagerEndpointUrl);
        addExtensionUserAgent(client);
        return client;
    }

    public async stop(): Promise<void> {
        this.isSlot ?
            await this._client.webApps.stopSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.stop(this.resourceGroup, this.siteName);
    }

    public async start(): Promise<void> {
        this.isSlot ?
            await this._client.webApps.startSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.start(this.resourceGroup, this.siteName);
    }

    public async getState(): Promise<string | undefined> {
        return (this.isSlot ?
            await this._client.webApps.getSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.get(this.resourceGroup, this.siteName)).state;
    }

    public async getWebAppPublishCredential(): Promise<User> {
        return this.isSlot ?
            await this._client.webApps.listPublishingCredentialsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listPublishingCredentials(this.resourceGroup, this.siteName);
    }

    public async getSiteConfig(): Promise<SiteConfigResource> {
        return this.isSlot ?
            await this._client.webApps.getConfigurationSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.getConfiguration(this.resourceGroup, this.siteName);
    }

    public async updateConfiguration(config: SiteConfigResource): Promise<SiteConfigResource> {
        return this.isSlot ?
            await this._client.webApps.updateConfigurationSlot(this.resourceGroup, this.siteName, config, this.slotName) :
            await this._client.webApps.updateConfiguration(this.resourceGroup, this.siteName, config);
    }

    public async getLogsConfig(): Promise<SiteLogsConfig> {
        return this.isSlot ?
            await this._client.webApps.getDiagnosticLogsConfigurationSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.getDiagnosticLogsConfiguration(this.resourceGroup, this.siteName);
    }

    public async updateLogsConfig(config: SiteLogsConfig): Promise<SiteLogsConfig> {
        return this.isSlot ?
            await this._client.webApps.updateDiagnosticLogsConfigSlot(this.resourceGroup, this.siteName, config, this.slotName) :
            await this._client.webApps.updateDiagnosticLogsConfig(this.resourceGroup, this.siteName, config);
    }

    public async getAppServicePlan(): Promise<AppServicePlan> {
        return await this._client.appServicePlans.get(this.planResourceGroup, this.planName);
    }

    public async updateSourceControl(siteSourceControl: SiteSourceControl): Promise<SiteSourceControl> {
        return this.isSlot ?
            await this._client.webApps.createOrUpdateSourceControlSlot(this.resourceGroup, this.siteName, siteSourceControl, this.slotName) :
            await this._client.webApps.createOrUpdateSourceControl(this.resourceGroup, this.siteName, siteSourceControl);
    }

    public async syncRepository(): Promise<void> {
        return this.isSlot ?
            await this._client.webApps.syncRepositorySlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.syncRepository(this.resourceGroup, this.siteName);
    }

    public async listApplicationSettings(): Promise<StringDictionary> {
        return this.isSlot ?
            await this._client.webApps.listApplicationSettingsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listApplicationSettings(this.resourceGroup, this.siteName);
    }

    public async updateApplicationSettings(appSettings: StringDictionary): Promise<StringDictionary> {
        return this.isSlot ?
            await this._client.webApps.updateApplicationSettingsSlot(this.resourceGroup, this.siteName, appSettings, this.slotName) :
            await this._client.webApps.updateApplicationSettings(this.resourceGroup, this.siteName, appSettings);
    }

    public async deleteMethod(options?: { deleteMetrics?: boolean, deleteEmptyServerFarm?: boolean, skipDnsRegistration?: boolean, customHeaders?: { [headerName: string]: string; } }): Promise<void> {
        return this.isSlot ?
            await this._client.webApps.deleteSlot(this.resourceGroup, this.siteName, this.slotName, options) :
            await this._client.webApps.deleteMethod(this.resourceGroup, this.siteName, options);
    }

    public async listInstanceIdentifiers(): Promise<WebAppInstanceCollection> {
        return this.isSlot ?
            await this._client.webApps.listInstanceIdentifiersSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listInstanceIdentifiers(this.resourceGroup, this.siteName);
    }

    public async listSourceControls(): Promise<SourceControlCollection> {
        return await this._client.listSourceControls();
    }
}
