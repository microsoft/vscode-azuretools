/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { CheckNameAvailabilityResult, StorageAccount } from 'azure-arm-storage/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { OutputChannel } from 'vscode';
import { AzureWizardStep, IAzureQuickPickOptions, IAzureUserInput } from 'vscode-azureextensionui';
import { IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class StorageAccountStep extends AzureWizardStep<IAppServiceWizardContext> {
    private readonly _createNewItem: IAzureQuickPickItem<StorageAccount> = {
        label: localize('NewStorageAccount', '$(plus) Create New Storage Account'),
        description: null,
        data: null
    };

    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {
        const credentials: ServiceClientCredentials = wizardContext.credentials;
        const subscription: Subscription = wizardContext.subscription;
        const storageClient: StorageManagementClient = new StorageManagementClient(credentials, subscription.subscriptionId);

        const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select a storage account that supports blobs, queues and tables.', id: `NewWebApp.StorageAccount/${subscription.id}` };
        const storageAccount: StorageAccount = (await ui.showQuickPick(this.getQuickPicks(storageClient.storageAccounts.list()), quickPickOptions)).data;

        if (storageAccount) {
            wizardContext.createNewStorageAccount = false;

            const [, resourceGroupName] = storageAccount.id.match(/\/resourceGroups\/([^/]+)\//);
            wizardContext.storageAccount = {
                name: storageAccount.name,
                location: storageAccount.location,
                sku: storageAccount.sku
            };
            wizardContext.storageResourceGroup = resourceGroupName;
            return wizardContext;
        }

        wizardContext.createNewStorageAccount = true;

        const suggestedName: string = await wizardContext.relatedNameTask;
        let newAccountName: string;
        newAccountName = await ui.showInputBox({
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

        wizardContext.storageAccount = {
            name: newAccountName.trim(),
            sku: { name: 'Standard_LRS' },
            location: wizardContext.resourceGroup.location
        };
        wizardContext.storageResourceGroup = wizardContext.resourceGroup.name;
        return wizardContext;
    }

    public async execute(wizardContext: IAppServiceWizardContext, outputChannel: OutputChannel): Promise<IAppServiceWizardContext> {
        if (!wizardContext.createNewStorageAccount) {
            outputChannel.appendLine(localize('UsingStorageAccount', 'Using storage account "{0} ({1}, {2})".', wizardContext.storageAccount.name, wizardContext.storageAccount.location, wizardContext.storageAccount.sku.name));
            return wizardContext;
        }

        outputChannel.appendLine(localize('CreatingNewStorageAccount', 'Creating new storage account "{0} ({1}, {2})"...', wizardContext.storageAccount.name, wizardContext.storageAccount.location, wizardContext.storageAccount.sku.name));
        const credentials: ServiceClientCredentials = wizardContext.credentials;
        const subscription: Subscription = wizardContext.subscription;
        const storageClient: StorageManagementClient = new StorageManagementClient(credentials, subscription.subscriptionId);
        await storageClient.storageAccounts.create(
            wizardContext.resourceGroup.name,
            wizardContext.storageAccount.name,
            {
                sku: wizardContext.storageAccount.sku,
                kind: 'Storage',
                location: wizardContext.storageAccount.location
            }
        );
        outputChannel.appendLine(localize('CreatedStorageAccount', 'Created storage account "{0} ({1}, {2})".', wizardContext.storageAccount.name, wizardContext.storageAccount.location, wizardContext.storageAccount.sku.name));
        return wizardContext;
    }

    private async getQuickPicks(storageAccountsTask: Promise<StorageAccount[]>): Promise<IAzureQuickPickItem<StorageAccount>[]> {
        const storageAccounts: StorageAccount[] = await storageAccountsTask;
        return [this._createNewItem].concat(storageAccounts.map((sa: StorageAccount) => {
            return {
                id: sa.id,
                label: sa.name,
                description: '',
                detail: '',
                data: sa
            };
        }));
    }
}
