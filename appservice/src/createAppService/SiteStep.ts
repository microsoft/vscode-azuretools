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
import { Site, SiteConfig } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { localize } from '../localize';
import { randomUtils } from '../utils/randomUtils';
import { IQuickPickItemWithData } from '../wizard/IQuickPickItemWithData';
import { WizardStep } from '../wizard/WizardStep';
import { AppKind, getAppKindDisplayName, getSiteModelKind, WebsiteOS } from './AppKind';
import { AppServiceCreator } from './AppServiceCreator';
import { StorageAccountStep } from './StorageAccountStep';

interface ILinuxRuntimeStack {
    name: string;
    displayName: string;
}

export class SiteStep extends WizardStep {
    protected readonly wizard: AppServiceCreator;

    private _website: Site;

    private readonly _appKind: AppKind;
    private readonly _websiteOS: WebsiteOS;

    constructor(wizard: AppServiceCreator, appKind: AppKind, websiteOS: WebsiteOS) {
        super(wizard);
        this._appKind = appKind;
        this._websiteOS = websiteOS;
    }

    public async prompt(): Promise<void> {
        const siteName: string = this.wizard.websiteNameStep.websiteName;

        let runtimeStack: string;
        const runtimeItems: IQuickPickItemWithData<ILinuxRuntimeStack>[] = [];
        const linuxRuntimeStacks: ILinuxRuntimeStack[] = this.getLinuxRuntimeStack();

        linuxRuntimeStacks.forEach((rt: ILinuxRuntimeStack) => {
            runtimeItems.push({
                persistenceId: rt.name,
                label: rt.displayName,
                description: '',
                data: rt
            });
        });

        if (this._websiteOS === WebsiteOS.linux) {
            const pickedItem: ILinuxRuntimeStack = await this.showQuickPick(runtimeItems, { placeHolder: 'Select Linux runtime stack.' }, 'NewWebApp.RuntimeStack');
            runtimeStack = pickedItem.name;
        } else {
            runtimeStack = undefined;
        }

        const rg: ResourceGroup = this.wizard.resourceGroupStep.resourceGroup;

        this._website = {
            name: siteName,
            kind: getSiteModelKind(this._appKind, this._websiteOS),
            location: rg.location,
            serverFarmId: this.wizard.appServicePlanStep ? this.wizard.appServicePlanStep.servicePlan.id : undefined,
            siteConfig: {
                linuxFxVersion: runtimeStack
                // The rest will be filled in during execute
            }
        };
    }

    public async execute(): Promise<void> {
        this.wizard.writeline(localize('CreatingNewApp', 'Creating new {0} "{1}"...', getAppKindDisplayName(this._appKind), this._website.name));
        const credentials: ServiceClientCredentials = this.wizard.subscriptionStep.credentials;
        const subscription: Subscription = this.wizard.subscriptionStep.subscription;
        const rg: ResourceGroup = this.wizard.resourceGroupStep.resourceGroup;
        const websiteClient: WebSiteManagementClient = new WebSiteManagementClient(credentials, subscription.subscriptionId);

        // If the plan is also newly created, its resource ID won't be available at this step's prompt stage, but should be available now.
        if (!this._website.serverFarmId) {
            this._website.serverFarmId = this.wizard.appServicePlanStep ? this.wizard.appServicePlanStep.servicePlan.id : undefined;
        }

        // Finish putting together the site configuration
        switch (this._appKind) {
            case AppKind.functionapp:
                this._website.siteConfig = await this.getFunctionAppSiteConfig(this._website.siteConfig.linuxFxVersion);
                break;
            case AppKind.app:
            default:
                this._website.siteConfig = { linuxFxVersion: this._website.siteConfig.linuxFxVersion };
        }

        this._website = await websiteClient.webApps.createOrUpdate(rg.name, this._website.name, this._website);
        this._website.siteConfig = await websiteClient.webApps.getConfiguration(rg.name, this._website.name);

        this.wizard.writeline(localize('CreatedNewApp', '>>>>>> Created new {0} "{1}": {2}', getAppKindDisplayName(this._appKind), this._website.name, `https://${this._website.defaultHostName} <<<<<<`));
        this.wizard.writeline('');
    }

    get site(): Site {
        return this._website;
    }

    private async getFunctionAppSiteConfig(linuxFxVersion: string): Promise<SiteConfig> {
        const maxFileShareNameLength: number = 63;
        const credentials: ServiceClientCredentials = this.wizard.subscriptionStep.credentials;
        const subscription: Subscription = this.wizard.subscriptionStep.subscription;
        const storageClient: StorageManagementClient = new StorageManagementClient(credentials, subscription.subscriptionId);

        const storageAccountStep: StorageAccountStep = this.wizard.storageAccountStep;

        const keysResult: StorageAccountListKeysResult = await storageClient.storageAccounts.listKeys(storageAccountStep.resourceGroup, storageAccountStep.storageAccount.name);

        let fileShareName: string = this.site.name.toLocaleLowerCase() + '-content'.slice(0, maxFileShareNameLength);
        if (!storageAccountStep.createNew) {
            const randomLetters: number = 4;
            fileShareName = `${fileShareName.slice(0, maxFileShareNameLength - randomLetters - 1)}-${randomUtils.getRandomHexString(randomLetters)}`;
        }

        let storageConnectionString: string = '';
        if (keysResult.keys && keysResult.keys[0].value) {
            storageConnectionString = `DefaultEndpointsProtocol=https;AccountName=${storageAccountStep.storageAccount.name};AccountKey=${keysResult.keys[0].value}`;
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
                displayName: 'Node.js 6.11 (LTS - Recommended for new apps)'
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
