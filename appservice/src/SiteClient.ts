/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from 'azure-arm-website';
import { AppServicePlan, FunctionEnvelopeCollection, FunctionSecrets, HostNameSslState, Site, SiteConfigResource, SiteLogsConfig, SiteSourceControl, SlotConfigNamesResource, SourceControlCollection, StringDictionary, User, WebAppInstanceCollection, WebJobCollection } from 'azure-arm-website/lib/models';
import { addExtensionUserAgent, createAzureClient, ISubscriptionRoot, parseError } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { FunctionEnvelope } from 'vscode-azurekudu/lib/models';
import { localize } from './localize';
import { nonNullProp, nonNullValue } from './utils/nonNull';

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
    public readonly initialState?: string;
    public readonly isFunctionApp: boolean;
    public readonly isLinux: boolean;

    public readonly planResourceGroup: string;
    public readonly planName: string;

    public readonly defaultHostName: string;
    public readonly defaultHostUrl: string;
    public readonly kuduHostName: string | undefined;
    public readonly kuduUrl: string | undefined;
    public readonly gitUrl: string | undefined;

    private readonly _subscription: ISubscriptionRoot;
    private _funcPreviewSlotError: Error = new Error(localize('functionsSlotPreview', 'This operation is not supported for slots, which are still in preview.'));

    constructor(site: Site, subscription: ISubscriptionRoot) {
        let matches: RegExpMatchArray | null = nonNullProp(site, 'serverFarmId').match(/\/subscriptions\/(.*)\/resourceGroups\/(.*)\/providers\/Microsoft.Web\/serverfarms\/(.*)/);
        matches = nonNullValue(matches, 'Invalid serverFarmId.');

        this.id = nonNullProp(site, 'id');
        [this.siteName, this.slotName] = nonNullProp(site, 'name').split('/');
        this.isSlot = !!this.slotName;
        this.fullName = this.siteName + (this.slotName ? `-${this.slotName}` : '');

        this.resourceGroup = nonNullProp(site, 'resourceGroup');
        this.location = site.location;
        this.serverFarmId = nonNullProp(site, 'serverFarmId');
        this.kind = nonNullProp(site, 'kind');
        this.initialState = site.state;
        this.isFunctionApp = !!site.kind && site.kind.includes('functionapp');
        this.isLinux = !!site.kind && site.kind.toLowerCase().includes('linux');

        this.planResourceGroup = matches[2];
        this.planName = matches[3];

        this.defaultHostName = nonNullProp(site, 'defaultHostName');
        this.defaultHostUrl = `https://${this.defaultHostName}`;
        const kuduRepositoryUrl: HostNameSslState | undefined = nonNullProp(site, 'hostNameSslStates').find((h: HostNameSslState) => !!h.hostType && h.hostType.toLowerCase() === 'repository');
        if (kuduRepositoryUrl) {
            this.kuduHostName = kuduRepositoryUrl.name;
            this.kuduUrl = `https://${this.kuduHostName}`;
            this.gitUrl = `${this.kuduHostName}:443/${site.repositorySiteName}.git`;
        }

        this._subscription = subscription;
    }

    private get _client(): WebSiteManagementClient {
        return createAzureClient(this._subscription, WebSiteManagementClient);
    }

    public get kudu(): KuduClient {
        if (!this.kuduHostName) {
            throw new Error(localize('notSupportedLinux', 'This operation is not supported by this app service plan.'));
        }
        const kuduClient: KuduClient = new KuduClient(this._subscription.credentials, this.kuduUrl);
        addExtensionUserAgent(kuduClient);
        return kuduClient;
    }

    public async stop(): Promise<void> {
        this.slotName ?
            await this._client.webApps.stopSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.stop(this.resourceGroup, this.siteName);
    }

    public async start(): Promise<void> {
        this.slotName ?
            await this._client.webApps.startSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.start(this.resourceGroup, this.siteName);
    }

    public async getState(): Promise<string | undefined> {
        return (this.slotName ?
            await this._client.webApps.getSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.get(this.resourceGroup, this.siteName)).state;
    }

    public async getWebAppPublishCredential(): Promise<User> {
        return this.slotName ?
            await this._client.webApps.listPublishingCredentialsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listPublishingCredentials(this.resourceGroup, this.siteName);
    }

    public async getSiteConfig(): Promise<SiteConfigResource> {
        return this.slotName ?
            await this._client.webApps.getConfigurationSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.getConfiguration(this.resourceGroup, this.siteName);
    }

    public async updateConfiguration(config: SiteConfigResource): Promise<SiteConfigResource> {
        return this.slotName ?
            await this._client.webApps.updateConfigurationSlot(this.resourceGroup, this.siteName, config, this.slotName) :
            await this._client.webApps.updateConfiguration(this.resourceGroup, this.siteName, config);
    }

    public async getLogsConfig(): Promise<SiteLogsConfig> {
        return this.slotName ?
            await this._client.webApps.getDiagnosticLogsConfigurationSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.getDiagnosticLogsConfiguration(this.resourceGroup, this.siteName);
    }

    public async updateLogsConfig(config: SiteLogsConfig): Promise<SiteLogsConfig> {
        return this.slotName ?
            await this._client.webApps.updateDiagnosticLogsConfigSlot(this.resourceGroup, this.siteName, config, this.slotName) :
            await this._client.webApps.updateDiagnosticLogsConfig(this.resourceGroup, this.siteName, config);
    }

    public async getAppServicePlan(): Promise<AppServicePlan | undefined> {
        return await this._client.appServicePlans.get(this.planResourceGroup, this.planName);
    }

    public async getSourceControl(): Promise<SiteSourceControl> {
        return this.slotName ?
            await this._client.webApps.getSourceControlSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.getSourceControl(this.resourceGroup, this.siteName);
    }

    public async updateSourceControl(siteSourceControl: SiteSourceControl): Promise<SiteSourceControl> {
        return this.slotName ?
            await this._client.webApps.createOrUpdateSourceControlSlot(this.resourceGroup, this.siteName, siteSourceControl, this.slotName) :
            await this._client.webApps.createOrUpdateSourceControl(this.resourceGroup, this.siteName, siteSourceControl);
    }

    public async syncRepository(): Promise<void> {
        return this.slotName ?
            await this._client.webApps.syncRepositorySlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.syncRepository(this.resourceGroup, this.siteName);
    }

    public async listApplicationSettings(): Promise<StringDictionary> {
        return this.slotName ?
            await this._client.webApps.listApplicationSettingsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listApplicationSettings(this.resourceGroup, this.siteName);
    }

    public async updateApplicationSettings(appSettings: StringDictionary): Promise<StringDictionary> {
        return this.slotName ?
            await this._client.webApps.updateApplicationSettingsSlot(this.resourceGroup, this.siteName, appSettings, this.slotName) :
            await this._client.webApps.updateApplicationSettings(this.resourceGroup, this.siteName, appSettings);
    }

    public async listSlotConfigurationNames(): Promise<SlotConfigNamesResource> {
        return await this._client.webApps.listSlotConfigurationNames(this.resourceGroup, this.siteName);
    }

    public async updateSlotConfigurationNames(appSettings: SlotConfigNamesResource): Promise<SlotConfigNamesResource> {
        return await this._client.webApps.updateSlotConfigurationNames(this.resourceGroup, this.siteName, appSettings);
    }

    public async deleteMethod(options?: { deleteMetrics?: boolean, deleteEmptyServerFarm?: boolean, skipDnsRegistration?: boolean, customHeaders?: { [headerName: string]: string; } }): Promise<void> {
        return this.slotName ?
            await this._client.webApps.deleteSlot(this.resourceGroup, this.siteName, this.slotName, options) :
            await this._client.webApps.deleteMethod(this.resourceGroup, this.siteName, options);
    }

    public async listInstanceIdentifiers(): Promise<WebAppInstanceCollection> {
        return this.slotName ?
            await this._client.webApps.listInstanceIdentifiersSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listInstanceIdentifiers(this.resourceGroup, this.siteName);
    }

    public async listSourceControls(): Promise<SourceControlCollection> {
        return await this._client.listSourceControls();
    }

    public async listFunctions(): Promise<FunctionEnvelopeCollection> {
        if (this.slotName) {
            throw this._funcPreviewSlotError;
        } else {
            return await this._client.webApps.listFunctions(this.resourceGroup, this.siteName);
        }
    }

    public async listFunctionsNext(nextPageLink: string): Promise<FunctionEnvelopeCollection> {
        if (this.slotName) {
            throw this._funcPreviewSlotError;
        } else {
            return await this._client.webApps.listFunctionsNext(nextPageLink);
        }
    }

    public async getFunction(functionName: string): Promise<FunctionEnvelope> {
        if (this.slotName) {
            throw this._funcPreviewSlotError;
        } else {
            return await this._client.webApps.getFunction(this.resourceGroup, this.siteName, functionName);
        }
    }

    public async deleteFunction(functionName: string): Promise<void> {
        if (this.slotName) {
            throw this._funcPreviewSlotError;
        } else {
            return await this._client.webApps.deleteFunction(this.resourceGroup, this.siteName, functionName);
        }
    }

    public async listFunctionSecrets(functionName: string): Promise<FunctionSecrets> {
        return this.slotName ?
            await this._client.webApps.listFunctionSecretsSlot(this.resourceGroup, this.siteName, functionName, this.slotName) :
            await this._client.webApps.listFunctionSecrets(this.resourceGroup, this.siteName, functionName);
    }

    public async getFunctionsAdminToken(): Promise<string> {
        return this.slotName ?
            await this._client.webApps.getFunctionsAdminTokenSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.getFunctionsAdminToken(this.resourceGroup, this.siteName);
    }

    public async syncFunctionTriggers(): Promise<void> {
        try {
            this.slotName ?
                await this._client.webApps.syncFunctionTriggersSlot(this.resourceGroup, this.siteName, this.slotName) :
                await this._client.webApps.syncFunctionTriggers(this.resourceGroup, this.siteName);
        } catch (error) {
            // For some reason this call incorrectly throws an error when the status code is 200
            if (parseError(error).errorType !== '200') {
                throw error;
            }
        }
    }

    public async getPublishingUser(): Promise<User> {
        return await this._client.getPublishingUser({});
    }

    public async listWebJobs(): Promise<WebJobCollection> {
        return this.slotName ?
            await this._client.webApps.listWebJobsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listWebJobs(this.resourceGroup, this.siteName);
    }
}
