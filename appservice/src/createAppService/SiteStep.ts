/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import { Subscription } from 'azure-arm-resource/lib/subscription/models';
// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { StorageAccountListKeysResult } from 'azure-arm-storage/lib/models';
// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { SiteConfig } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
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
    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {
        const siteName: string = wizardContext.websiteName;

        let runtimeStack: string;
        const runtimeItems: IAzureQuickPickItem<ILinuxRuntimeStack>[] = [];
        const linuxRuntimeStacks: ILinuxRuntimeStack[] = this.getLinuxRuntimeStack();

        linuxRuntimeStacks.forEach((rt: ILinuxRuntimeStack) => {
            runtimeItems.push({
                id: rt.name,
                label: rt.displayName,
                description: '',
                data: rt
            });
        });

        if (wizardContext.websiteOS === WebsiteOS.linux) {
            const pickedItem: ILinuxRuntimeStack = (await ui.showQuickPick(runtimeItems, { placeHolder: 'Select Linux runtime stack.' })).data;
            runtimeStack = pickedItem.name;
        } else {
            runtimeStack = undefined;
        }

        const rg: ResourceGroup = wizardContext.resourceGroup;

        wizardContext.site = {
            name: siteName,
            kind: getSiteModelKind(wizardContext.appKind, wizardContext.websiteOS),
            location: rg.location,
            serverFarmId: wizardContext.plan ? wizardContext.plan.id : undefined,
            siteConfig: {
                linuxFxVersion: runtimeStack
                // The rest will be filled in during execute
            }
        };

        return wizardContext;
    }

    public async execute(wizardContext: IAppServiceWizardContext, outputChannel: OutputChannel): Promise<IAppServiceWizardContext> {
        outputChannel.appendLine(localize('CreatingNewApp', 'Creating new {0} "{1}"...', getAppKindDisplayName(wizardContext.appKind), wizardContext.site.name));
        const credentials: ServiceClientCredentials = wizardContext.credentials;
        const subscription: Subscription = wizardContext.subscription;
        const rg: ResourceGroup = wizardContext.resourceGroup;
        const websiteClient: WebSiteManagementClient = new WebSiteManagementClient(credentials, subscription.subscriptionId);

        // If the plan is also newly created, its resource ID won't be available at this step's prompt stage, but should be available now.
        if (!wizardContext.site.serverFarmId) {
            wizardContext.site.serverFarmId = wizardContext.plan ? wizardContext.plan.id : undefined;
        }

        // Finish putting together the site configuration
        switch (wizardContext.appKind) {
            case AppKind.functionapp:
                wizardContext.site.siteConfig = await this.getFunctionAppSiteConfig(wizardContext, wizardContext.site.siteConfig.linuxFxVersion);
                break;
            case AppKind.app:
            default:
                wizardContext.site.siteConfig = { linuxFxVersion: wizardContext.site.siteConfig.linuxFxVersion };
        }

        wizardContext.site = await websiteClient.webApps.createOrUpdate(rg.name, wizardContext.site.name, wizardContext.site);
        wizardContext.site.siteConfig = await websiteClient.webApps.getConfiguration(rg.name, wizardContext.site.name);

        outputChannel.appendLine(localize('CreatedNewApp', '>>>>>> Created new {0} "{1}": {2}', getAppKindDisplayName(wizardContext.appKind), wizardContext.site.name, `https://${wizardContext.site.defaultHostName} <<<<<<`));
        outputChannel.appendLine('');

        return wizardContext;
    }

    private async getFunctionAppSiteConfig(wizardContext: IAppServiceWizardContext, linuxFxVersion: string): Promise<SiteConfig> {
        const maxFileShareNameLength: number = 63;
        const credentials: ServiceClientCredentials = wizardContext.credentials;
        const subscription: Subscription = wizardContext.subscription;
        const storageClient: StorageManagementClient = new StorageManagementClient(credentials, subscription.subscriptionId);

        const keysResult: StorageAccountListKeysResult = await storageClient.storageAccounts.listKeys(wizardContext.storageResourceGroup, wizardContext.storageAccount.name);

        let fileShareName: string = wizardContext.site.name.toLocaleLowerCase() + '-content'.slice(0, maxFileShareNameLength);
        if (!wizardContext.createNewStorageAccount) {
            const randomLetters: number = 4;
            fileShareName = `${fileShareName.slice(0, maxFileShareNameLength - randomLetters - 1)}-${randomUtils.getRandomHexString(randomLetters)}`;
        }

        let storageConnectionString: string = '';
        if (keysResult.keys && keysResult.keys[0].value) {
            storageConnectionString = `DefaultEndpointsProtocol=https;AccountName=${wizardContext.storageAccount.name};AccountKey=${keysResult.keys[0].value}`;
        }

        return <SiteConfig>{
            linuxFxVersion: linuxFxVersion,
            appSettings: [
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
            ],
            clientAffinityEnabled: false
        };
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
