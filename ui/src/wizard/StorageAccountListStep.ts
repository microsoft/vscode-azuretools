/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { CheckNameAvailabilityResult, Sku, StorageAccount } from 'azure-arm-storage/lib/models';
import { OutputChannel } from 'vscode';
import { IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IAzureUserInput, IStorageAccountWizardContext } from '../../index';
import { localize } from '../localize';
import { AzureWizardStep } from './AzureWizardStep';
import { LocationStep } from './LocationStep';

export const storageAccountNamingRules: IAzureNamingRules = {
    minLength: 3,
    maxLength: 24,
    invalidCharsRegExp: /[^a-z0-9]/,
    lowercaseOnly: true
};

export class StorageAccountStep<T extends IStorageAccountWizardContext> extends AzureWizardStep<T> {
    private _newName: string;

    public static async isNameAvailable<T extends IStorageAccountWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const storageClient: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
        return !!(await storageClient.storageAccounts.checkNameAvailability(name)).nameAvailable;
    }

    public async prompt(wizardContext: T, ui: IAzureUserInput): Promise<T> {
        const client: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscriptionId);

        const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select a storage account that supports blobs, queues and tables.', id: `StorageAccountStep/${wizardContext.subscriptionId}` };
        wizardContext.storageAccount = (await ui.showQuickPick(this.getQuickPicks(client.storageAccounts.list()), quickPickOptions)).data;

        if (wizardContext.storageAccount) {
            // tslint:disable-next-line:no-non-null-assertion
            await LocationStep.setLocation(wizardContext, wizardContext.storageAccount.location!);
        } else {
            const suggestedName: string | undefined = wizardContext.relatedNameTask ? await wizardContext.relatedNameTask : undefined;
            this._newName = (await ui.showInputBox({
                value: suggestedName,
                prompt: 'Enter the name of the new storage account.',
                validateInput: async (value: string): Promise<string | undefined> => await this.validateStorageAccountName(client, value)
            })).trim();
        }

        return wizardContext;
    }

    public async execute(wizardContext: T, outputChannel: OutputChannel): Promise<T> {
        if (wizardContext.storageAccount) {
            // tslint:disable-next-line:no-non-null-assertion
            outputChannel.appendLine(localize('UsingStorageAccount', 'Using storage account "{0}" in location "{1}" with sku "{2}".', wizardContext.storageAccount.name, wizardContext.storageAccount.location, wizardContext.storageAccount.sku!.name));
        } else {
            // tslint:disable-next-line:no-non-null-assertion
            const newLocation: string = wizardContext.location!.name!;
            const newSku: Sku = { name: 'Standard_LRS' };
            outputChannel.appendLine(localize('CreatingStorageAccount', 'Creating storage account "{0}" in location "{1}" with sku "{2}"...', this._newName, newLocation, newSku.name));

            const storageClient: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
            wizardContext.storageAccount = await storageClient.storageAccounts.create(
                // tslint:disable-next-line:no-non-null-assertion
                wizardContext.resourceGroup!.name!,
                this._newName,
                {
                    sku: newSku,
                    kind: 'Storage',
                    location: newLocation
                }
            );
            outputChannel.appendLine(localize('CreatedStorageAccount', 'Successfully created storage account "{0}".', this._newName));
        }

        return wizardContext;
    }

    private async getQuickPicks(storageAccountsTask: Promise<StorageAccount[]>): Promise<IAzureQuickPickItem<StorageAccount | undefined>[]> {
        const picks: IAzureQuickPickItem<StorageAccount | undefined>[] = [{
            label: localize('NewStorageAccount', '$(plus) Create new storage account'),
            description: '',
            data: undefined
        }];

        const storageAccounts: StorageAccount[] = await storageAccountsTask;
        return picks.concat(storageAccounts.map((sa: StorageAccount) => {
            return {
                id: sa.id,
                // tslint:disable-next-line:no-non-null-assertion
                label: sa.name!,
                description: '',
                data: sa
            };
        }));
    }

    private async validateStorageAccountName(client: StorageManagementClient, value: string): Promise<string | undefined> {
        value = value ? value.trim() : '';

        if (!value || value.length < storageAccountNamingRules.minLength || value.length > storageAccountNamingRules.maxLength) {
            return localize('invalidLength', 'The name must be between {0} and {1} characters.', storageAccountNamingRules.minLength, storageAccountNamingRules.maxLength);
        } else if (value.match(storageAccountNamingRules.invalidCharsRegExp) !== null) {
            return localize('invalidChars', "The name can only contain lowercase letters and numbers.");
        } else {
            const nameAvailabilityResult: CheckNameAvailabilityResult = await client.storageAccounts.checkNameAvailability(value);
            if (!nameAvailabilityResult.nameAvailable) {
                return nameAvailabilityResult.message;
            } else {
                return undefined;
            }
        }
    }
}
