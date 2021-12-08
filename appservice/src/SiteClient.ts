/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { WebSiteManagementClient, WebSiteManagementModels as Models } from '@azure/arm-appservice';
import type { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import { createGenericClient, IActionContext, ISubscriptionContext, parseError } from 'vscode-azureextensionui';
import { AppKind } from './createAppService/AppKind';
import { AppSettingsClientProvider, IAppSettingsClient } from './IAppSettingsClient';
import { deleteFunctionSlot, getFunctionSlot, listFunctionsSlot } from './slotFunctionOperations';
import { tryGetAppServicePlan, tryGetWebApp, tryGetWebAppSlot } from './tryGetSiteResource';
import { createWebSiteClient } from './utils/azureClients';
import { nonNullProp, nonNullValue } from './utils/nonNull';

export class ParsedSite implements AppSettingsClientProvider {
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
    public readonly isWorkflowApp: boolean;
    public readonly isKubernetesApp: boolean;
    public readonly isLinux: boolean;

    public readonly planResourceGroup: string;
    public readonly planName: string;

    public readonly defaultHostName: string;
    public readonly defaultHostUrl: string;
    public readonly kuduHostName: string | undefined;
    public readonly kuduUrl: string | undefined;
    public readonly gitUrl: string | undefined;

    public readonly subscription: ISubscriptionContext;

    public readonly rawSite: Models.Site;

    constructor(site: Models.Site, subscription: ISubscriptionContext) {
        this.rawSite = site;

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

        const kind: string = (site.kind || '').toLowerCase();
        this.isFunctionApp = kind.includes(AppKind.functionapp);
        this.isWorkflowApp = kind.includes(AppKind.workflowapp);
        this.isKubernetesApp = kind.includes('kubernetes');
        this.isLinux = kind.includes('linux');

        this.planResourceGroup = matches[2];
        this.planName = matches[3];

        this.defaultHostName = nonNullProp(site, 'defaultHostName');
        this.defaultHostUrl = `https://${this.defaultHostName}`;
        const kuduRepositoryUrl: Models.HostNameSslState | undefined = nonNullProp(site, 'hostNameSslStates').find(h => !!h.hostType && h.hostType.toLowerCase() === 'repository');
        if (kuduRepositoryUrl) {
            this.kuduHostName = kuduRepositoryUrl.name;
            this.kuduUrl = `https://${this.kuduHostName}`;
            this.gitUrl = `${this.kuduHostName}:443/${site.repositorySiteName}.git`;
        }

        this.subscription = subscription;
    }

    public async createClient(context: IActionContext & { _parsedSiteClients?: { [id: string]: SiteClient | undefined } }): Promise<SiteClient> {
        let client = context._parsedSiteClients?.[this.id];
        if (!client) {
            const internalClient = await createWebSiteClient([context, this.subscription]);
            const internalGenericClient = await createGenericClient(context, this.subscription);
            client = new SiteClient(internalClient, internalGenericClient, this);

            context._parsedSiteClients ||= {};
            context._parsedSiteClients[this.id] = client;
        }

        return client;
    }
}

/**
 * Wrapper of a WebSiteManagementClient for use with a specific Site
 * Reduces the number of arguments needed for every call and automatically ensures the 'slot' method is called when appropriate
 */
export class SiteClient implements IAppSettingsClient {
    private _client: WebSiteManagementClient;
    private _genericClient: ServiceClient;
    private _site: ParsedSite;
    private _cachedSku: string | undefined;

    constructor(internalClient: WebSiteManagementClient, internalGenericClient: ServiceClient, site: ParsedSite) {
        this._client = internalClient;
        this._genericClient = internalGenericClient;
        this._site = site;
    }

    public get fullName(): string {
        return this._site.fullName;
    }

    public get isLinux(): boolean {
        return this._site.isLinux;
    }

    public async getIsConsumption(context: IActionContext): Promise<boolean> {
        if (this._site.isFunctionApp) {
            const sku: string | undefined = await this.getCachedSku(context);
            return !!sku && sku.toLowerCase() === 'dynamic';
        } else {
            return false;
        }
    }

    public async stop(): Promise<void> {
        this._site.slotName ?
            await this._client.webApps.stopSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.stop(this._site.resourceGroup, this._site.siteName);
    }

    public async start(): Promise<void> {
        this._site.slotName ?
            await this._client.webApps.startSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.start(this._site.resourceGroup, this._site.siteName);
    }

    public async getSite(): Promise<Models.Site | undefined> {
        return (this._site.slotName ?
            await tryGetWebAppSlot(this._client, this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await tryGetWebApp(this._client, this._site.resourceGroup, this._site.siteName));
    }

    public async getState(): Promise<string | undefined> {
        return (await this.getSite())?.state;
    }

    public async getWebAppPublishCredential(): Promise<Models.User> {
        return this._site.slotName ?
            await this._client.webApps.listPublishingCredentialsSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.listPublishingCredentials(this._site.resourceGroup, this._site.siteName);
    }

    public async getSiteConfig(): Promise<Models.SiteConfigResource> {
        return this._site.slotName ?
            await this._client.webApps.getConfigurationSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.getConfiguration(this._site.resourceGroup, this._site.siteName);
    }

    public async updateConfiguration(config: Models.SiteConfigResource): Promise<Models.SiteConfigResource> {
        return this._site.slotName ?
            await this._client.webApps.updateConfigurationSlot(this._site.resourceGroup, this._site.siteName, config, this._site.slotName) :
            await this._client.webApps.updateConfiguration(this._site.resourceGroup, this._site.siteName, config);
    }

    public async getLogsConfig(): Promise<Models.SiteLogsConfig> {
        return this._site.slotName ?
            await this._client.webApps.getDiagnosticLogsConfigurationSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.getDiagnosticLogsConfiguration(this._site.resourceGroup, this._site.siteName);
    }

    public async updateLogsConfig(config: Models.SiteLogsConfig): Promise<Models.SiteLogsConfig> {
        return this._site.slotName ?
            await this._client.webApps.updateDiagnosticLogsConfigSlot(this._site.resourceGroup, this._site.siteName, config, this._site.slotName) :
            await this._client.webApps.updateDiagnosticLogsConfig(this._site.resourceGroup, this._site.siteName, config);
    }

    public async getAppServicePlan(): Promise<Models.AppServicePlan | undefined> {
        return await tryGetAppServicePlan(this._client, this._site.planResourceGroup, this._site.planName);
    }

    public async getSourceControl(): Promise<Models.SiteSourceControl> {
        return this._site.slotName ?
            await this._client.webApps.getSourceControlSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.getSourceControl(this._site.resourceGroup, this._site.siteName);
    }

    public async updateSourceControl(siteSourceControl: Models.SiteSourceControl): Promise<Models.SiteSourceControl> {
        return this._site.slotName ?
            await this._client.webApps.createOrUpdateSourceControlSlot(this._site.resourceGroup, this._site.siteName, siteSourceControl, this._site.slotName) :
            await this._client.webApps.createOrUpdateSourceControl(this._site.resourceGroup, this._site.siteName, siteSourceControl);
    }

    public async syncRepository(): Promise<void> {
        this._site.slotName ?
            await this._client.webApps.syncRepositorySlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.syncRepository(this._site.resourceGroup, this._site.siteName);
    }

    public async listApplicationSettings(): Promise<Models.StringDictionary> {
        return this._site.slotName ?
            await this._client.webApps.listApplicationSettingsSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.listApplicationSettings(this._site.resourceGroup, this._site.siteName);
    }

    public async updateApplicationSettings(appSettings: Models.StringDictionary): Promise<Models.StringDictionary> {
        return this._site.slotName ?
            await this._client.webApps.updateApplicationSettingsSlot(this._site.resourceGroup, this._site.siteName, appSettings, this._site.slotName) :
            await this._client.webApps.updateApplicationSettings(this._site.resourceGroup, this._site.siteName, appSettings);
    }

    public async listSlotConfigurationNames(): Promise<Models.SlotConfigNamesResource> {
        return await this._client.webApps.listSlotConfigurationNames(this._site.resourceGroup, this._site.siteName);
    }

    public async updateSlotConfigurationNames(appSettings: Models.SlotConfigNamesResource): Promise<Models.SlotConfigNamesResource> {
        return await this._client.webApps.updateSlotConfigurationNames(this._site.resourceGroup, this._site.siteName, appSettings);
    }

    public async deleteMethod(options?: { deleteMetrics?: boolean, deleteEmptyServerFarm?: boolean, skipDnsRegistration?: boolean, customHeaders?: { [headerName: string]: string; } }): Promise<void> {
        this._site.slotName ?
            await this._client.webApps.deleteSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName, options) :
            await this._client.webApps.deleteMethod(this._site.resourceGroup, this._site.siteName, options);
    }

    public async listInstanceIdentifiers(): Promise<Models.WebAppInstanceCollection> {
        return this._site.slotName ?
            await this._client.webApps.listInstanceIdentifiersSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.listInstanceIdentifiers(this._site.resourceGroup, this._site.siteName);
    }

    public async listSourceControls(): Promise<Models.SourceControlCollection> {
        return await this._client.listSourceControls();
    }

    public async listFunctions(): Promise<Models.FunctionEnvelopeCollection> {
        if (this._site.slotName) {
            return await listFunctionsSlot(this._genericClient, this._site.id);
        } else {
            return await this._client.webApps.listFunctions(this._site.resourceGroup, this._site.siteName);
        }
    }

    public async listFunctionsNext(nextPageLink: string): Promise<Models.FunctionEnvelopeCollection> {
        return await this._client.webApps.listFunctionsNext(nextPageLink);
    }

    public async getFunction(functionName: string): Promise<Models.FunctionEnvelope> {
        if (this._site.slotName) {
            return await getFunctionSlot(this._genericClient, this._site.id, functionName);
        } else {
            return await this._client.webApps.getFunction(this._site.resourceGroup, this._site.siteName, functionName);
        }
    }

    public async deleteFunction(functionName: string): Promise<void> {
        if (this._site.slotName) {
            await deleteFunctionSlot(this._genericClient, this._site.id, functionName);
        } else {
            await this._client.webApps.deleteFunction(this._site.resourceGroup, this._site.siteName, functionName);
        }
    }

    public async listFunctionSecrets(functionName: string): Promise<Models.FunctionSecrets> {
        return this._site.slotName ?
            await this._client.webApps.listFunctionSecretsSlot(this._site.resourceGroup, this._site.siteName, functionName, this._site.slotName) :
            await this._client.webApps.listFunctionSecrets(this._site.resourceGroup, this._site.siteName, functionName);
    }

    public async syncFunctionTriggers(): Promise<void> {
        try {
            this._site.slotName ?
                await this._client.webApps.syncFunctionTriggersSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
                await this._client.webApps.syncFunctionTriggers(this._site.resourceGroup, this._site.siteName);
        } catch (error) {
            // For some reason this call incorrectly throws an error when the status code is 200
            if (parseError(error).errorType !== '200') {
                throw error;
            }
        }
    }

    public async getPublishingUser(): Promise<Models.User> {
        return await this._client.getPublishingUser({});
    }

    public async listWebJobs(): Promise<Models.WebJobCollection> {
        return this._site.slotName ?
            await this._client.webApps.listWebJobsSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.listWebJobs(this._site.resourceGroup, this._site.siteName);
    }

    public async listHostKeys(): Promise<Models.HostKeys> {
        return this._site.slotName ?
            await this._client.webApps.listHostKeysSlot(this._site.resourceGroup, this._site.siteName, this._site.slotName) :
            await this._client.webApps.listHostKeys(this._site.resourceGroup, this._site.siteName);
    }

    public async listFunctionKeys(functionName: string): Promise<IFunctionKeys> {
        return this._site.slotName ?
            await this._client.webApps.listFunctionKeysSlot(this._site.resourceGroup, this._site.siteName, functionName, this._site.slotName) :
            await this._client.webApps.listFunctionKeys(this._site.resourceGroup, this._site.siteName, functionName);
    }

    /**
     * Temporary workaround because the azure sdk doesn't return the full site object from Azure
     * Hopefully this can be removed when we move to the new sdk
     * Also, we're caching the sku - for better performance and because it's unlikely to change
     */
    private async getCachedSku(context: IActionContext): Promise<string | undefined> {
        if (!this._cachedSku) {
            const client: ServiceClient = await createGenericClient(context, this._site.subscription);
            const response: HttpOperationResponse = await client.sendRequest({ method: 'GET', url: `${this._site.id}?api-version=2016-08-01` });
            this._cachedSku = (<{ properties: { sku?: string } }>response.parsedBody).properties.sku;
        }
        return this._cachedSku;
    }
}

/**
 * The type in the sdk doesn't seem to be accurate
 */
export interface IFunctionKeys extends Models.WebAppsListFunctionKeysResponse {
    default?: string;
}
