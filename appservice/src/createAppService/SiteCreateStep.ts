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
import { AppKind, WebsiteOS } from './AppKind';
import { getNewFileShareName } from './getNewFileShareName';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export interface IAppSettingsContext {
    storageConnectionString?: string;
    fileShareName?: string;
    os: string;
    runtime?: string;
    aiInstrumentationKey?: string;
}

export class SiteCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 140;

    private createSiteAppSettings: ((context: IAppSettingsContext) => Promise<NameValuePair[]>);

    public constructor(createSiteAppSettings: ((context: IAppSettingsContext) => Promise<NameValuePair[]>)) {
        super();
        this.createSiteAppSettings = createSiteAppSettings;
    }

    public async execute(wizardContext: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const creatingNewApp: string = wizardContext.newSiteKind === AppKind.functionapp ?
            localize('creatingNewFunctionApp', 'Creating new function app "{0}"...', wizardContext.newSiteName) :
            localize('creatingNewWebApp', 'Creating new web app "{0}"...', wizardContext.newSiteName);
        ext.outputChannel.appendLog(creatingNewApp);
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
        let storageConnectionString: string | undefined;
        let fileShareName: string | undefined;

        if (wizardContext.newSiteKind === AppKind.app) {
            newSiteConfig.linuxFxVersion = wizardContext.newSiteRuntime;
        } else {
            if (wizardContext.newSiteOS === 'linux') {
                if (wizardContext.useConsumptionPlan) {
                    newSiteConfig.use32BitWorkerProcess = false; // Needs to be explicitly set to false per the platform team
                } else {
                    newSiteConfig.linuxFxVersion = getFunctionAppLinuxFxVersion(nonNullProp(wizardContext, 'newSiteRuntime'));
                }
            }

            const storageClient: StorageManagementClient = createAzureClient(wizardContext, StorageManagementClient);

            const storageAccount: StorageAccount = nonNullProp(wizardContext, 'storageAccount');
            const [, storageResourceGroup] = nonNullValue(nonNullProp(storageAccount, 'id').match(/\/resourceGroups\/([^/]+)\//), 'Invalid storage account id');
            const keysResult: StorageAccountListKeysResult = await storageClient.storageAccounts.listKeys(storageResourceGroup, nonNullProp(storageAccount, 'name'));

            fileShareName = getNewFileShareName(nonNullProp(wizardContext, 'newSiteName'));

            // https://github.com/Azure/azure-sdk-for-node/issues/4706
            const endpointSuffix: string = wizardContext.environment.storageEndpointSuffix.replace(/^\./, '');

            storageConnectionString = '';
            if (keysResult.keys && keysResult.keys[0].value) {
                storageConnectionString = `DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${keysResult.keys[0].value};EndpointSuffix=${endpointSuffix}`;
            }
        }

        newSiteConfig.appSettings = await this.createSiteAppSettings(
            {
                storageConnectionString,
                fileShareName,
                os: nonNullProp(wizardContext, 'newSiteOS'),
                runtime: wizardContext.newSiteRuntime,
                // tslint:disable-next-line: strict-boolean-expressions
                aiInstrumentationKey: wizardContext.appInsightsComponent && wizardContext.appInsightsComponent ? wizardContext.appInsightsComponent.instrumentationKey : undefined
            });

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
