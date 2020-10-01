/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels as Models } from '@azure/arm-appservice';
import { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import { appendExtensionUserAgent, createAzureClient, createGenericClient, ISubscriptionContext, parseError } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { ISimplifiedSiteClient } from './ISimplifiedSiteClient';
import { localize } from './localize';
import { deleteFunctionSlot, getFunctionSlot, listFunctionsSlot } from './slotFunctionOperations';
import { tryGetAppServicePlan, tryGetWebApp, tryGetWebAppSlot } from './tryGetSiteResource';
import { nonNullProp, nonNullValue } from './utils/nonNull';

/**
 * Wrapper of a WebSiteManagementClient for use with a specific Site
 * Reduces the number of arguments needed for every call and automatically ensures the 'slot' method is called when appropriate
 */
export class SiteClient implements ISimplifiedSiteClient {
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

    public readonly subscription: ISubscriptionContext;

    private _cachedSku: string | undefined;

    constructor(site: Models.Site, subscription: ISubscriptionContext) {
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
        const kuduRepositoryUrl: Models.HostNameSslState | undefined = nonNullProp(site, 'hostNameSslStates').find(h => !!h.hostType && h.hostType.toLowerCase() === 'repository');
        if (kuduRepositoryUrl) {
            this.kuduHostName = kuduRepositoryUrl.name;
            this.kuduUrl = `https://${this.kuduHostName}`;
            this.gitUrl = `${this.kuduHostName}:443/${site.repositorySiteName}.git`;
        }

        this.subscription = subscription;
    }

    private get _client(): WebSiteManagementClient {
        return createAzureClient(this.subscription, WebSiteManagementClient);
    }

    public async getIsConsumption(): Promise<boolean> {
        if (this.isFunctionApp) {
            const sku: string | undefined = await this.getCachedSku();
            return !!sku && sku.toLowerCase() === 'dynamic';
        } else {
            return false;
        }
    }

    public async getKuduClient(): Promise<KuduClient> {
        if (!this.kuduHostName) {
            throw new Error(localize('notSupportedLinux', 'This operation is not supported by this app service plan.'));
        }

        return new KuduClient(this.subscription.credentials, {
            baseUri: this.kuduUrl,
            userAgent: appendExtensionUserAgent
        });
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
            await tryGetWebAppSlot(this._client, this.resourceGroup, this.siteName, this.slotName) :
            await tryGetWebApp(this._client, this.resourceGroup, this.siteName))?.state;
    }

    public async getWebAppPublishCredential(): Promise<Models.User> {
        return this.slotName ?
            await this._client.webApps.listPublishingCredentialsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listPublishingCredentials(this.resourceGroup, this.siteName);
    }

    public async getSiteConfig(): Promise<Models.SiteConfigResource> {
        return this.slotName ?
            await this._client.webApps.getConfigurationSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.getConfiguration(this.resourceGroup, this.siteName);
    }

    public async updateConfiguration(config: Models.SiteConfigResource): Promise<Models.SiteConfigResource> {
        return this.slotName ?
            await this._client.webApps.updateConfigurationSlot(this.resourceGroup, this.siteName, config, this.slotName) :
            await this._client.webApps.updateConfiguration(this.resourceGroup, this.siteName, config);
    }

    public async getLogsConfig(): Promise<Models.SiteLogsConfig> {
        return this.slotName ?
            await this._client.webApps.getDiagnosticLogsConfigurationSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.getDiagnosticLogsConfiguration(this.resourceGroup, this.siteName);
    }

    public async updateLogsConfig(config: Models.SiteLogsConfig): Promise<Models.SiteLogsConfig> {
        return this.slotName ?
            await this._client.webApps.updateDiagnosticLogsConfigSlot(this.resourceGroup, this.siteName, config, this.slotName) :
            await this._client.webApps.updateDiagnosticLogsConfig(this.resourceGroup, this.siteName, config);
    }

    public async getAppServicePlan(): Promise<Models.AppServicePlan | undefined> {
        return await tryGetAppServicePlan(this._client, this.planResourceGroup, this.planName);
    }

    public async getSourceControl(): Promise<Models.SiteSourceControl> {
        return this.slotName ?
            await this._client.webApps.getSourceControlSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.getSourceControl(this.resourceGroup, this.siteName);
    }

    public async updateSourceControl(siteSourceControl: Models.SiteSourceControl): Promise<Models.SiteSourceControl> {
        return this.slotName ?
            await this._client.webApps.createOrUpdateSourceControlSlot(this.resourceGroup, this.siteName, siteSourceControl, this.slotName) :
            await this._client.webApps.createOrUpdateSourceControl(this.resourceGroup, this.siteName, siteSourceControl);
    }

    public async syncRepository(): Promise<void> {
        this.slotName ?
            await this._client.webApps.syncRepositorySlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.syncRepository(this.resourceGroup, this.siteName);
    }

    public async listApplicationSettings(): Promise<Models.StringDictionary> {
        return this.slotName ?
            await this._client.webApps.listApplicationSettingsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listApplicationSettings(this.resourceGroup, this.siteName);
    }

    public async updateApplicationSettings(appSettings: Models.StringDictionary): Promise<Models.StringDictionary> {
        return this.slotName ?
            await this._client.webApps.updateApplicationSettingsSlot(this.resourceGroup, this.siteName, appSettings, this.slotName) :
            await this._client.webApps.updateApplicationSettings(this.resourceGroup, this.siteName, appSettings);
    }

    public async listSlotConfigurationNames(): Promise<Models.SlotConfigNamesResource> {
        return await this._client.webApps.listSlotConfigurationNames(this.resourceGroup, this.siteName);
    }

    public async updateSlotConfigurationNames(appSettings: Models.SlotConfigNamesResource): Promise<Models.SlotConfigNamesResource> {
        return await this._client.webApps.updateSlotConfigurationNames(this.resourceGroup, this.siteName, appSettings);
    }

    public async deleteMethod(options?: { deleteMetrics?: boolean, deleteEmptyServerFarm?: boolean, skipDnsRegistration?: boolean, customHeaders?: { [headerName: string]: string; } }): Promise<void> {
        this.slotName ?
            await this._client.webApps.deleteSlot(this.resourceGroup, this.siteName, this.slotName, options) :
            await this._client.webApps.deleteMethod(this.resourceGroup, this.siteName, options);
    }

    public async listInstanceIdentifiers(): Promise<Models.WebAppInstanceCollection> {
        return this.slotName ?
            await this._client.webApps.listInstanceIdentifiersSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listInstanceIdentifiers(this.resourceGroup, this.siteName);
    }

    public async listSourceControls(): Promise<Models.SourceControlCollection> {
        return await this._client.listSourceControls();
    }

    public async listFunctions(): Promise<Models.FunctionEnvelopeCollection> {
        if (this.slotName) {
            return await listFunctionsSlot(this.subscription, this.id);
        } else {
            return await this._client.webApps.listFunctions(this.resourceGroup, this.siteName);
        }
    }

    public async listFunctionsNext(nextPageLink: string): Promise<Models.FunctionEnvelopeCollection> {
        return await this._client.webApps.listFunctionsNext(nextPageLink);
    }

    public async getFunction(functionName: string): Promise<Models.FunctionEnvelope> {
        if (this.slotName) {
            return await getFunctionSlot(this.subscription, this.id, functionName);
        } else {
            return await this._client.webApps.getFunction(this.resourceGroup, this.siteName, functionName);
        }
    }

    public async deleteFunction(functionName: string): Promise<void> {
        if (this.slotName) {
            await deleteFunctionSlot(this.subscription, this.id, functionName);
        } else {
            await this._client.webApps.deleteFunction(this.resourceGroup, this.siteName, functionName);
        }
    }

    public async listFunctionSecrets(functionName: string): Promise<Models.FunctionSecrets> {
        return this.slotName ?
            await this._client.webApps.listFunctionSecretsSlot(this.resourceGroup, this.siteName, functionName, this.slotName) :
            await this._client.webApps.listFunctionSecrets(this.resourceGroup, this.siteName, functionName);
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

    public async getPublishingUser(): Promise<Models.User> {
        return await this._client.getPublishingUser({});
    }

    public async listWebJobs(): Promise<Models.WebJobCollection> {
        return this.slotName ?
            await this._client.webApps.listWebJobsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listWebJobs(this.resourceGroup, this.siteName);
    }

    public async listHostKeys(): Promise<Models.HostKeys> {
        return this.slotName ?
            await this._client.webApps.listHostKeysSlot(this.resourceGroup, this.siteName, this.slotName) :
            await this._client.webApps.listHostKeys(this.resourceGroup, this.siteName);
    }

    public async listFunctionKeys(functionName: string): Promise<IFunctionKeys> {
        return this.slotName ?
            await this._client.webApps.listFunctionKeysSlot(this.resourceGroup, this.siteName, functionName, this.slotName) :
            await this._client.webApps.listFunctionKeys(this.resourceGroup, this.siteName, functionName);
    }

    /**
     * Temporary workaround because the azure sdk doesn't return the full site object from Azure
     * Hopefully this can be removed when we move to the new sdk
     * Also, we're caching the sku - for better performance and because it's unlikely to change
     */
    private async getCachedSku(): Promise<string | undefined> {
        if (!this._cachedSku) {
            const client: ServiceClient = await createGenericClient(this.subscription);
            const response: HttpOperationResponse = await client.sendRequest({ method: 'GET', url: `${this.id}?api-version=2016-08-01` });
            this._cachedSku = (<{ properties: { sku?: string } }>response.parsedBody).properties.sku;
        }
        return this._cachedSku;
    }
}

/**
 * The type in the sdk doesn't seem to be accurate
 */
export interface IFunctionKeys extends Models.WebAppsListFunctionKeysResponse {
    // tslint:disable-next-line: no-reserved-keywords
    default?: string;
}
