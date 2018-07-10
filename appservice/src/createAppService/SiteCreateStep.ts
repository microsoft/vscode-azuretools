/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { StorageAccountListKeysResult } from 'azure-arm-storage/lib/models';
// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { SiteConfig } from 'azure-arm-website/lib/models';
import { MessageItem, ProgressLocation, window } from 'vscode';
import { addExtensionUserAgent, AzureWizardExecuteStep } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { randomUtils } from '../utils/randomUtils';
import { AppKind, getAppKindDisplayName, getSiteModelKind } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class SiteCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    private _functionAppSettings: { [key: string]: string };

    public constructor(functionAppSettings: { [key: string]: string } | undefined) {
        super();
        this._functionAppSettings = functionAppSettings || {};
    }

    public async execute(wizardContext: IAppServiceWizardContext): Promise<IAppServiceWizardContext> {
        if (!wizardContext.site) {
            const creatingNewApp: string = localize('CreatingNewApp', 'Creating {0} "{1}"...', getAppKindDisplayName(wizardContext.newSiteKind), wizardContext.newSiteName);
            await window.withProgress({ location: ProgressLocation.Notification, title: creatingNewApp }, async (): Promise<void> => {
                ext.outputChannel.appendLine(creatingNewApp);
                const client: WebSiteManagementClient = new WebSiteManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
                addExtensionUserAgent(client);
                wizardContext.site = await client.webApps.createOrUpdate(wizardContext.resourceGroup.name, wizardContext.newSiteName, {
                    name: wizardContext.newSiteName,
                    kind: getSiteModelKind(wizardContext.newSiteKind, wizardContext.newSiteOS),
                    location: wizardContext.location.name,
                    serverFarmId: wizardContext.plan ? wizardContext.plan.id : undefined,
                    clientAffinityEnabled: wizardContext.newSiteKind === AppKind.app,
                    siteConfig: await this.getNewSiteConfig(wizardContext)
                });
                const createdNewApp: string = localize('CreatedNewApp', 'Created new {0} "{1}": {2}', getAppKindDisplayName(wizardContext.newSiteKind), wizardContext.site.name, `https://${wizardContext.site.defaultHostName}`);
                ext.outputChannel.appendLine(createdNewApp);
                ext.outputChannel.appendLine('');
                const viewLogs: MessageItem = {
                    title: localize('viewLogs', 'View Logs')
                };

                // Note: intentionally not waiting for the result of this before returning
                window.showInformationMessage(createdNewApp, viewLogs).then((result: MessageItem | undefined) => {
                    if (result === viewLogs) {
                        ext.outputChannel.show();
                    }
                });
            });
        }

        return wizardContext;
    }

    private async getNewSiteConfig(wizardContext: IAppServiceWizardContext): Promise<SiteConfig> {
        const newSiteConfig: SiteConfig = {
            linuxFxVersion: wizardContext.newSiteRuntime
        };

        if (wizardContext.newSiteKind === AppKind.functionapp) {
            const maxFileShareNameLength: number = 63;
            const storageClient: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
            addExtensionUserAgent(storageClient);

            const [, storageResourceGroup] = wizardContext.storageAccount.id.match(/\/resourceGroups\/([^/]+)\//);
            const keysResult: StorageAccountListKeysResult = await storageClient.storageAccounts.listKeys(storageResourceGroup, wizardContext.storageAccount.name);

            let fileShareName: string = wizardContext.newSiteName.toLocaleLowerCase() + '-content'.slice(0, maxFileShareNameLength);
            if (!wizardContext.newStorageAccountName) {
                const randomLetters: number = 4;
                fileShareName = `${fileShareName.slice(0, maxFileShareNameLength - randomLetters - 1)}-${randomUtils.getRandomHexString(randomLetters)}`;
            }

            let storageConnectionString: string = '';
            if (keysResult.keys && keysResult.keys[0].value) {
                storageConnectionString = `DefaultEndpointsProtocol=https;AccountName=${wizardContext.storageAccount.name};AccountKey=${keysResult.keys[0].value}`;
            }

            newSiteConfig.appSettings = [
                {
                    name: 'AzureWebJobsDashboard',
                    value: storageConnectionString
                },
                {
                    name: 'AzureWebJobsStorage',
                    value: storageConnectionString
                },
                {
                    name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING',
                    value: storageConnectionString
                },
                {
                    name: 'WEBSITE_CONTENTSHARE',
                    value: fileShareName
                }
            ];

            for (const key of Object.keys(this._functionAppSettings)) {
                newSiteConfig.appSettings.push({
                    name: key,
                    value: this._functionAppSettings[key]
                });
            }
        }

        return newSiteConfig;
    }
}
