/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, FunctionEnvelope, FunctionEnvelopeCollection, FunctionSecrets, SiteConfigResource, SiteLogsConfig, SiteSourceControl, SlotConfigNamesResource, SourceControlCollection, StringDictionary, User, WebAppInstanceCollection, WebJobCollection } from 'azure-arm-website/lib/models';
import KuduClient from 'vscode-azurekudu';
import { IFunctionKeys, IHostKeys } from '.';

export interface ISiteClient {
    readonly id: string;
    readonly isSlot: boolean;
    /**
     * The main site name (does not include the slot name)
     */
    readonly siteName: string;
    readonly slotName?: string;
    /**
     * Combination of the site name and slot name (if applicable), separated by a hyphen
     */
    readonly fullName: string;
    readonly resourceGroup: string;
    readonly location: string;
    readonly serverFarmId: string;
    readonly kind: string;
    readonly initialState?: string;
    readonly isFunctionApp: boolean;
    readonly isLinux: boolean;
    readonly planResourceGroup: string;
    readonly planName: string;
    readonly defaultHostName: string;
    readonly defaultHostUrl: string;
    readonly kuduHostName: string | undefined;
    readonly kuduUrl: string | undefined;
    readonly gitUrl: string | undefined;
    getIsConsumption(): Promise<boolean>;
    getKuduClient(): Promise<KuduClient>;
    stop(): Promise<void>;
    start(): Promise<void>;
    getState(): Promise<string | undefined>;
    getWebAppPublishCredential(): Promise<User>;
    getSiteConfig(): Promise<SiteConfigResource>;
    updateConfiguration(config: SiteConfigResource): Promise<SiteConfigResource>;
    getLogsConfig(): Promise<SiteLogsConfig>;
    updateLogsConfig(config: SiteLogsConfig): Promise<SiteLogsConfig>;
    getAppServicePlan(): Promise<AppServicePlan | undefined>;
    getSourceControl(): Promise<SiteSourceControl>;
    updateSourceControl(siteSourceControl: SiteSourceControl): Promise<SiteSourceControl>;
    syncRepository(): Promise<void>;
    listApplicationSettings(): Promise<StringDictionary>;
    updateApplicationSettings(appSettings: StringDictionary): Promise<StringDictionary>;
    listSlotConfigurationNames(): Promise<SlotConfigNamesResource>;
    updateSlotConfigurationNames(appSettings: SlotConfigNamesResource): Promise<SlotConfigNamesResource>;
    deleteMethod(options?: {
        deleteMetrics?: boolean;
        deleteEmptyServerFarm?: boolean;
        skipDnsRegistration?: boolean;
        customHeaders?: {
            [headerName: string]: string;
        };
    }): Promise<void>;
    listInstanceIdentifiers(): Promise<WebAppInstanceCollection>;
    listSourceControls(): Promise<SourceControlCollection>;
    listFunctions(): Promise<FunctionEnvelopeCollection>;
    listFunctionsNext(nextPageLink: string): Promise<FunctionEnvelopeCollection>;
    getFunction(functionName: string): Promise<FunctionEnvelope>;
    deleteFunction(functionName: string): Promise<void>;
    listFunctionSecrets(functionName: string): Promise<FunctionSecrets>;
    syncFunctionTriggers(): Promise<void>;
    getPublishingUser(): Promise<User>;
    listWebJobs(): Promise<WebJobCollection>;
    /**
     * Temporary workaround because this isn't in azure sdk yet
     * Spec: https://github.com/Azure/azure-functions-host/issues/3994
     */
    listHostKeys(): Promise<IHostKeys>;
    /**
     * Temporary workaround because this isn't in azure sdk yet
     * Spec: https://github.com/Azure/azure-functions-host/issues/3994
     */
    listFunctionKeys(functionName: string): Promise<IFunctionKeys>;
    /**
     * Temporary workaround because the azure sdk doesn't return the full site object from Azure
     * Hopefully this can be removed when we move to the new sdk
     * Also, we're caching the sku - for better performance and because it's unlikely to change
     */
}
