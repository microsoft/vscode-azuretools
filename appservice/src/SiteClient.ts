/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels as Models } from '@azure/arm-appservice';
import { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import { createGenericClient, IActionContext, ISubscriptionContext, parseError } from 'vscode-azureextensionui';
import { AppKind } from './createAppService/AppKind';
import { deleteFunctionSlot, getFunctionSlot, listFunctionsSlot } from './slotFunctionOperations';
import { tryGetAppServicePlan, tryGetWebApp, tryGetWebAppSlot } from './tryGetSiteResource';
import { createWebSiteClient } from './utils/azureClients';
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

    private _cachedSku: string | undefined;

    constructor(context: IActionContext, site: Models.Site, subscription: ISubscriptionContext) {
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

        context.valuesToMask.push(this.fullName);
    }

    public async getIsConsumption(): Promise<boolean> {
        if (this.isFunctionApp) {
            const sku: string | undefined = await this.getCachedSku();
            return !!sku && sku.toLowerCase() === 'dynamic';
        } else {
            return false;
        }
    }

    public async stop(): Promise<void> {
        const client: WebSiteManagementClient = await this.createClient();
        this.slotName ?
            await client.webApps.stopSlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.stop(this.resourceGroup, this.siteName);
    }

    public async start(): Promise<void> {
        const client: WebSiteManagementClient = await this.createClient();
        this.slotName ?
            await client.webApps.startSlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.start(this.resourceGroup, this.siteName);
    }

    public async getSite(): Promise<Models.Site | undefined> {
        const client: WebSiteManagementClient = await this.createClient();
        return (this.slotName ?
            await tryGetWebAppSlot(client, this.resourceGroup, this.siteName, this.slotName) :
            await tryGetWebApp(client, this.resourceGroup, this.siteName));
    }

    public async getState(): Promise<string | undefined> {
        return (await this.getSite())?.state;
    }

    public async getWebAppPublishCredential(): Promise<Models.User> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.listPublishingCredentialsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.listPublishingCredentials(this.resourceGroup, this.siteName);
    }

    public async getSiteConfig(): Promise<Models.SiteConfigResource> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.getConfigurationSlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.getConfiguration(this.resourceGroup, this.siteName);
    }

    public async updateConfiguration(config: Models.SiteConfigResource): Promise<Models.SiteConfigResource> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.updateConfigurationSlot(this.resourceGroup, this.siteName, config, this.slotName) :
            await client.webApps.updateConfiguration(this.resourceGroup, this.siteName, config);
    }

    public async getLogsConfig(): Promise<Models.SiteLogsConfig> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.getDiagnosticLogsConfigurationSlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.getDiagnosticLogsConfiguration(this.resourceGroup, this.siteName);
    }

    public async updateLogsConfig(config: Models.SiteLogsConfig): Promise<Models.SiteLogsConfig> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.updateDiagnosticLogsConfigSlot(this.resourceGroup, this.siteName, config, this.slotName) :
            await client.webApps.updateDiagnosticLogsConfig(this.resourceGroup, this.siteName, config);
    }

    public async getAppServicePlan(): Promise<Models.AppServicePlan | undefined> {
        const client: WebSiteManagementClient = await this.createClient();
        return await tryGetAppServicePlan(client, this.planResourceGroup, this.planName);
    }

    public async getSourceControl(): Promise<Models.SiteSourceControl> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.getSourceControlSlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.getSourceControl(this.resourceGroup, this.siteName);
    }

    public async updateSourceControl(siteSourceControl: Models.SiteSourceControl): Promise<Models.SiteSourceControl> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.createOrUpdateSourceControlSlot(this.resourceGroup, this.siteName, siteSourceControl, this.slotName) :
            await client.webApps.createOrUpdateSourceControl(this.resourceGroup, this.siteName, siteSourceControl);
    }

    public async syncRepository(): Promise<void> {
        const client: WebSiteManagementClient = await this.createClient();
        this.slotName ?
            await client.webApps.syncRepositorySlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.syncRepository(this.resourceGroup, this.siteName);
    }

    public async listApplicationSettings(): Promise<Models.StringDictionary> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.listApplicationSettingsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.listApplicationSettings(this.resourceGroup, this.siteName);
    }

    public async updateApplicationSettings(appSettings: Models.StringDictionary): Promise<Models.StringDictionary> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.updateApplicationSettingsSlot(this.resourceGroup, this.siteName, appSettings, this.slotName) :
            await client.webApps.updateApplicationSettings(this.resourceGroup, this.siteName, appSettings);
    }

    public async listSlotConfigurationNames(): Promise<Models.SlotConfigNamesResource> {
        const client: WebSiteManagementClient = await this.createClient();
        return await client.webApps.listSlotConfigurationNames(this.resourceGroup, this.siteName);
    }

    public async updateSlotConfigurationNames(appSettings: Models.SlotConfigNamesResource): Promise<Models.SlotConfigNamesResource> {
        const client: WebSiteManagementClient = await this.createClient();
        return await client.webApps.updateSlotConfigurationNames(this.resourceGroup, this.siteName, appSettings);
    }

    public async deleteMethod(options?: { deleteMetrics?: boolean, deleteEmptyServerFarm?: boolean, skipDnsRegistration?: boolean, customHeaders?: { [headerName: string]: string; } }): Promise<void> {
        const client: WebSiteManagementClient = await this.createClient();
        this.slotName ?
            await client.webApps.deleteSlot(this.resourceGroup, this.siteName, this.slotName, options) :
            await client.webApps.deleteMethod(this.resourceGroup, this.siteName, options);
    }

    public async listInstanceIdentifiers(): Promise<Models.WebAppInstanceCollection> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.listInstanceIdentifiersSlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.listInstanceIdentifiers(this.resourceGroup, this.siteName);
    }

    public async listSourceControls(): Promise<Models.SourceControlCollection> {
        const client: WebSiteManagementClient = await this.createClient();
        return await client.listSourceControls();
    }

    public async listFunctions(): Promise<Models.FunctionEnvelopeCollection> {
        const client: WebSiteManagementClient = await this.createClient();
        if (this.slotName) {
            return await listFunctionsSlot(this.subscription, this.id);
        } else {
            return await client.webApps.listFunctions(this.resourceGroup, this.siteName);
        }
    }

    public async listFunctionsNext(nextPageLink: string): Promise<Models.FunctionEnvelopeCollection> {
        const client: WebSiteManagementClient = await this.createClient();
        return await client.webApps.listFunctionsNext(nextPageLink);
    }

    public async getFunction(functionName: string): Promise<Models.FunctionEnvelope> {
        const client: WebSiteManagementClient = await this.createClient();
        if (this.slotName) {
            return await getFunctionSlot(this.subscription, this.id, functionName);
        } else {
            return await client.webApps.getFunction(this.resourceGroup, this.siteName, functionName);
        }
    }

    public async deleteFunction(functionName: string): Promise<void> {
        const client: WebSiteManagementClient = await this.createClient();
        if (this.slotName) {
            await deleteFunctionSlot(this.subscription, this.id, functionName);
        } else {
            await client.webApps.deleteFunction(this.resourceGroup, this.siteName, functionName);
        }
    }

    public async listFunctionSecrets(functionName: string): Promise<Models.FunctionSecrets> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.listFunctionSecretsSlot(this.resourceGroup, this.siteName, functionName, this.slotName) :
            await client.webApps.listFunctionSecrets(this.resourceGroup, this.siteName, functionName);
    }

    public async syncFunctionTriggers(): Promise<void> {
        const client: WebSiteManagementClient = await this.createClient();
        try {
            this.slotName ?
                await client.webApps.syncFunctionTriggersSlot(this.resourceGroup, this.siteName, this.slotName) :
                await client.webApps.syncFunctionTriggers(this.resourceGroup, this.siteName);
        } catch (error) {
            // For some reason this call incorrectly throws an error when the status code is 200
            if (parseError(error).errorType !== '200') {
                throw error;
            }
        }
    }

    public async getPublishingUser(): Promise<Models.User> {
        const client: WebSiteManagementClient = await this.createClient();
        return await client.getPublishingUser({});
    }

    public async listWebJobs(): Promise<Models.WebJobCollection> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.listWebJobsSlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.listWebJobs(this.resourceGroup, this.siteName);
    }

    public async listHostKeys(): Promise<Models.HostKeys> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.listHostKeysSlot(this.resourceGroup, this.siteName, this.slotName) :
            await client.webApps.listHostKeys(this.resourceGroup, this.siteName);
    }

    public async listFunctionKeys(functionName: string): Promise<IFunctionKeys> {
        const client: WebSiteManagementClient = await this.createClient();
        return this.slotName ?
            await client.webApps.listFunctionKeysSlot(this.resourceGroup, this.siteName, functionName, this.slotName) :
            await client.webApps.listFunctionKeys(this.resourceGroup, this.siteName, functionName);
    }

    private async createClient(): Promise<WebSiteManagementClient> {
        return await createWebSiteClient(this.subscription);
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
    default?: string;
}
