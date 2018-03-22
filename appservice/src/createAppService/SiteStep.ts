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
import { OutputChannel } from 'vscode';
import { IAzureQuickPickItem } from 'vscode-azureextensionui';
import { AzureWizardStep, IAzureUserInput } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { randomUtils } from '../utils/randomUtils';
import { AppKind, getAppKindDisplayName, getSiteModelKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

interface ILinuxRuntimeStack {
    name: string;
    displayName: string;
}

export class SiteStep extends AzureWizardStep<IAppServiceWizardContext> {
    private _newStorageAccount: boolean;
    private _newLinuxFxVersion: string | undefined;

    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {
        this._newStorageAccount = wizardContext.storageAccount === undefined;

        const runtimeItems: IAzureQuickPickItem<ILinuxRuntimeStack>[] = this.getLinuxRuntimeStack().map((rt: ILinuxRuntimeStack) => {
            return {
                id: rt.name,
                label: rt.displayName,
                description: '',
                data: rt
            };
        });

        if (wizardContext.websiteOS === WebsiteOS.linux) {
            this._newLinuxFxVersion = (await ui.showQuickPick(runtimeItems, { placeHolder: 'Select a runtime for your new Linux app.' })).data.name;
        }

        return wizardContext;
    }

    public async execute(wizardContext: IAppServiceWizardContext, outputChannel: OutputChannel): Promise<IAppServiceWizardContext> {
        outputChannel.appendLine(localize('CreatingNewApp', 'Creating {0} "{1}"...', getAppKindDisplayName(wizardContext.appKind), wizardContext.siteName));

        const websiteClient: WebSiteManagementClient = new WebSiteManagementClient(wizardContext.credentials, wizardContext.subscription.subscriptionId);
        wizardContext.site = await websiteClient.webApps.createOrUpdate(wizardContext.resourceGroup.name, wizardContext.siteName, {
            name: wizardContext.siteName,
            kind: getSiteModelKind(wizardContext.appKind, wizardContext.websiteOS),
            location: wizardContext.location.name,
            serverFarmId: wizardContext.plan ? wizardContext.plan.id : undefined,
            clientAffinityEnabled: wizardContext.appKind === AppKind.app,
            siteConfig: await this.getNewSiteConfig(wizardContext)
        });

        outputChannel.appendLine(localize('CreatedNewApp', '>>>>>> Created new {0} "{1}": {2}', getAppKindDisplayName(wizardContext.appKind), wizardContext.site.name, `https://${wizardContext.site.defaultHostName} <<<<<<`));
        outputChannel.appendLine('');

        return wizardContext;
    }

    private async getNewSiteConfig(wizardContext: IAppServiceWizardContext): Promise<SiteConfig> {
        const newSiteConfig: SiteConfig = {
            linuxFxVersion: this._newLinuxFxVersion
        };

        if (wizardContext.appKind === AppKind.functionapp) {
            const maxFileShareNameLength: number = 63;
            const storageClient: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscription.subscriptionId);

            const [, storageResourceGroup] = wizardContext.storageAccount.id.match(/\/resourceGroups\/([^/]+)\//);
            const keysResult: StorageAccountListKeysResult = await storageClient.storageAccounts.listKeys(storageResourceGroup, wizardContext.storageAccount.name);

            let fileShareName: string = wizardContext.siteName.toLocaleLowerCase() + '-content'.slice(0, maxFileShareNameLength);
            if (!this._newStorageAccount) {
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
                    name: 'FUNCTIONS_EXTENSION_VERSION',
                    value: 'latest'
                },
                {
                    name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING',
                    value: storageConnectionString
                },
                {
                    name: 'WEBSITE_CONTENTSHARE',
                    value: fileShareName
                },
                {
                    name: 'WEBSITE_NODE_DEFAULT_VERSION',
                    value: '6.5.0'
                }
            ];
        }

        return newSiteConfig;
    }

    private getLinuxRuntimeStack(): ILinuxRuntimeStack[] {
        return [
            {
                name: 'node|4.4',
                displayName: 'Node.js 4.4'
            },
            {
                name: 'node|4.5',
                displayName: 'Node.js 4.5'
            },
            {
                name: 'node|6.2',
                displayName: 'Node.js 6.2'
            },
            {
                name: 'node|6.6',
                displayName: 'Node.js 6.6'
            },
            {
                name: 'node|6.9',
                displayName: 'Node.js 6.9'
            },
            {
                name: 'node|6.10',
                displayName: 'Node.js 6.10'
            },
            {
                name: 'node|6.11',
                displayName: 'Node.js 6.11'
            },
            {
                name: 'node|8.0',
                displayName: 'Node.js 8.0'
            },
            {
                name: 'node|8.1',
                displayName: 'Node.js 8.1'
            },
            {
                name: 'node|8.2',
                displayName: 'Node.js 8.2'
            },
            {
                name: 'node|8.8',
                displayName: 'Node.js 8.8'
            },
            {
                name: 'node|8.9',
                displayName: 'Node.js 8.9 (LTS - Recommended for new apps)'
            },
            {
                name: 'node|9.4',
                displayName: 'Node.js 9.4'
            },
            {
                name: 'php|5.6',
                displayName: 'PHP 5.6'
            },
            {
                name: 'php|7.0',
                displayName: 'PHP 7.0'
            },
            {
                name: 'php|7.2',
                displayName: 'PHP 7.2'
            },
            {
                name: 'dotnetcore|1.0',
                displayName: '.NET Core 1.0'
            },
            {
                name: 'dotnetcore|1.1',
                displayName: '.NET Core 1.1'
            },
            {
                name: 'dotnetcore|2.0',
                displayName: '.NET Core 2.0'
            },
            {
                name: 'ruby|2.3',
                displayName: 'Ruby 2.3'
            }
        ];
    }
}
