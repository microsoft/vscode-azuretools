/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { CheckNameAvailabilityResult, StorageAccount } from 'azure-arm-storage/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { QuickPickOptions } from 'vscode';
import { localize } from '../localize';
import { IQuickPickItemWithData } from '../wizard/IQuickPickItemWithData';
import { WizardStep } from '../wizard/WizardStep';
import { AppServiceCreator } from './AppServiceCreator';

export class StorageAccountStep extends WizardStep {
    protected readonly wizard: AppServiceCreator;

    private _createNew: boolean;
    private _account: StorageAccount;
    private _resourceGroup: string;
    private readonly _createNewItem: IQuickPickItemWithData<StorageAccount> = {
        persistenceId: '',
        label: localize('NewStorageAccount', '$(plus) Create New Storage Account'),
        description: null,
        data: null
    };

    constructor(wizard: AppServiceCreator) {
        super(wizard);
    }

    public async prompt(): Promise<void> {
        const quickPickOptions: QuickPickOptions = { placeHolder: `Select a storage account that supports blobs, queues and tables. (${this.stepProgressText})` };
        const credentials: ServiceClientCredentials = this.wizard.subscriptionStep.credentials;
        const subscription: Subscription = this.wizard.subscriptionStep.subscription;
        const storageClient: StorageManagementClient = new StorageManagementClient(credentials, subscription.subscriptionId);

        const storageAccount: StorageAccount = await this.showQuickPick(this.getQuickPicks(storageClient.storageAccounts.list()), quickPickOptions, `"NewWebApp.StorageAccount/${subscription.id}`);

        if (storageAccount) {
            this._createNew = false;

            const [, resourceGroupName] = storageAccount.id.match(/\/resourceGroups\/([^/]+)\//);
            this._account = {
                name: storageAccount.name,
                location: storageAccount.location,
                sku: storageAccount.sku
            };
            this._resourceGroup = resourceGroupName;
            return;
        }

        this._createNew = true;

        const suggestedName: string = await this.wizard.websiteNameStep.computeRelatedName();
        let newAccountName: string;
        newAccountName = await this.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new storage account.',
            validateInput: async (value: string): Promise<string | undefined> => {
                value = value ? value.trim() : '';
                const nameAvailabilityResult: CheckNameAvailabilityResult = await storageClient.storageAccounts.checkNameAvailability(value);
                if (!nameAvailabilityResult.nameAvailable) {
                    return nameAvailabilityResult.message;
                }
                return undefined;
            }
        });

        this._account = {
            name: newAccountName.trim(),
            sku: { name: 'Standard_LRS' },
            location: this.wizard.resourceGroupStep.resourceGroup.location
        };
        this._resourceGroup = this.wizard.resourceGroupStep.resourceGroup.name;
    }

    public async execute(): Promise<void> {
        if (!this._createNew) {
            this.wizard.writeline(localize('UsingStorageAccount', 'Using storage account "{0} ({1}, {2})".', this._account.name, this._account.location, this._account.sku.name));
            return;
        }

        this.wizard.writeline(localize('CreatingNewStorageAccount', 'Creating new storage account "{0} ({1}, {2})"...', this._account.name, this._account.location, this._account.sku.name));
        const credentials: ServiceClientCredentials = this.wizard.subscriptionStep.credentials;
        const subscription: Subscription = this.wizard.subscriptionStep.subscription;
        const storageClient: StorageManagementClient = new StorageManagementClient(credentials, subscription.subscriptionId);
        await storageClient.storageAccounts.create(
            this.wizard.resourceGroupStep.resourceGroup.name,
            this._account.name,
            {
                sku: this._account.sku,
                kind: 'Storage',
                location: this._account.location
            }
        );
        this.wizard.writeline(localize('CreatedStorageAccount', 'Created storage account "{0} ({1}, {2})".', this._account.name, this._account.location, this._account.sku.name));
    }

    public get resourceGroup(): string {
        return this._resourceGroup;
    }

    public get storageAccount(): StorageAccount {
        return this._account;
    }

    public get createNew(): boolean {
        return this._createNew;
    }

    private async getQuickPicks(storageAccountsTask: Promise<StorageAccount[]>): Promise<IQuickPickItemWithData<StorageAccount>[]> {
        const storageAccounts: StorageAccount[] = await storageAccountsTask;
        return [this._createNewItem].concat(storageAccounts.map((sa: StorageAccount) => {
            return {
                persistenceId: sa.id,
                label: sa.name,
                description: '',
                detail: '',
                data: sa
            };
        }));
    }
}
