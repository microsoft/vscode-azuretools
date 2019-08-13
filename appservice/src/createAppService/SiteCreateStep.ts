/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { StorageAccount, StorageAccountListKeysResult } from 'azure-arm-storage/lib/models';
import { WebSiteManagementClient } from 'azure-arm-website';
import { NameValuePair, SiteConfig } from 'azure-arm-website/lib/models';
import { Progress } from 'vscode';
import { AzureWizardExecuteStep, createAzureClient } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp, nonNullValue, nonNullValueAndProp } from '../utils/nonNull';
import { randomUtils } from '../utils/randomUtils';
import { skipForNow } from './AppInsightsCreateStep';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export interface IAppSettingsContext {
    storageConnectionString: string;
    fileShareName: string;
    os: string;
    runtime: string;
    aiInstrumentationKey?: string;
}

export class SiteCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 140;

    private createFunctionAppSettings: ((context: IAppSettingsContext) => Promise<NameValuePair[]>) | undefined;

    public constructor(createFunctionAppSettings?: ((context: IAppSettingsContext) => Promise<NameValuePair[]>)) {
        super();
        this.createFunctionAppSettings = createFunctionAppSettings;
    }

    public async execute(wizardContext: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const creatingNewApp: string = wizardContext.newSiteKind === AppKind.functionapp ?
            localize('creatingNewFunctionApp', 'Creating new function app "{0}"...', wizardContext.newSiteName) :
            localize('creatingNewWebApp', 'Creating new web app "{0}"...', wizardContext.newSiteName);
        ext.outputChannel.appendLine(creatingNewApp);
        progress.report({ message: creatingNewApp });
        const client: WebSiteManagementClient = createAzureClient(wizardContext, WebSiteManagementClient);
        wizardContext.site = await client.webApps.createOrUpdate(nonNullValueAndProp(wizardContext.resourceGroup, 'name'), nonNullProp(wizardContext, 'newSiteName'), {
            name: wizardContext.newSiteName,
            kind: wizardContext.newSiteKind,
            location: nonNullValueAndProp(wizardContext.location, 'name'),
            serverFarmId: wizardContext.plan ? wizardContext.plan.id : undefined,
            clientAffinityEnabled: wizardContext.newSiteKind === AppKind.app,
            siteConfig: await this.getNewSiteConfig(wizardContext),
            reserved: wizardContext.newSiteOS === WebsiteOS.linux  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
        });
    }

    public shouldExecute(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.site;
    }

    private async getNewSiteConfig(wizardContext: IAppServiceWizardContext): Promise<SiteConfig> {
        const newSiteConfig: SiteConfig = {};
        if (wizardContext.newSiteKind === AppKind.app) {
            newSiteConfig.linuxFxVersion = wizardContext.newSiteRuntime;
        } else {
            if (!wizardContext.useConsumptionPlan && wizardContext.newSiteOS === 'linux') {
                newSiteConfig.linuxFxVersion = getFunctionAppLinuxFxVersion(nonNullProp(wizardContext, 'newSiteRuntime'));
            }

            const maxFileShareNameLength: number = 63;
            const storageClient: StorageManagementClient = createAzureClient(wizardContext, StorageManagementClient);

            const storageAccount: StorageAccount = nonNullProp(wizardContext, 'storageAccount');
            const [, storageResourceGroup] = nonNullValue(nonNullProp(storageAccount, 'id').match(/\/resourceGroups\/([^/]+)\//), 'Invalid storage account id');
            const keysResult: StorageAccountListKeysResult = await storageClient.storageAccounts.listKeys(storageResourceGroup, nonNullProp(storageAccount, 'name'));

            let fileShareName: string = nonNullProp(wizardContext, 'newSiteName').toLocaleLowerCase() + '-content'.slice(0, maxFileShareNameLength);
            if (!wizardContext.newStorageAccountName) {
                const randomLetters: number = 4;
                fileShareName = `${fileShareName.slice(0, maxFileShareNameLength - randomLetters - 1)}-${randomUtils.getRandomHexString(randomLetters)}`;
            }

            // https://github.com/Azure/azure-sdk-for-node/issues/4706
            const endpointSuffix: string = wizardContext.environment.storageEndpointSuffix.replace(/^\./, '');

            let storageConnectionString: string = '';
            if (keysResult.keys && keysResult.keys[0].value) {
                storageConnectionString = `DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${keysResult.keys[0].value};EndpointSuffix=${endpointSuffix}`;
            }

            if (this.createFunctionAppSettings) {
                newSiteConfig.appSettings = await this.createFunctionAppSettings({
                    storageConnectionString,
                    fileShareName,
                    // tslint:disable-next-line:no-non-null-assertion
                    os: wizardContext.newSiteOS!,
                    // tslint:disable-next-line:no-non-null-assertion
                    runtime: wizardContext.newSiteRuntime!,
                    aiInstrumentationKey: wizardContext.appInsightsComponent && wizardContext.appInsightsComponent typeof skipForNow ? wizardContext.appInsightsComponent.instrumentationKey : undefined
                });
            }
        }

        return newSiteConfig;
    }
}

function getFunctionAppLinuxFxVersion(runtime: string): string {
    let middlePart: string;
    switch (runtime) {
        case 'node':
            middlePart = 'node:2.0-node8';
            break;
        case 'python':
            middlePart = 'python:2.0-python3.6';
            break;
        case 'dotnet':
            middlePart = 'dotnet:2.0';
            break;
        default:
            throw new RangeError(localize('unexpectedRuntime', 'Unexpected runtime "{0}".', runtime));
    }

    return `DOCKER|mcr.microsoft.com/azure-functions/${middlePart}-appservice`;
}
