/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { ProgressLocation, window } from 'vscode';
import { INewStorageAccountDefaults, IStorageAccountWizardContext } from '../../index';
import { addExtensionUserAgent } from '../extensionUserAgent';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';

export class StorageAccountCreateStep<T extends IStorageAccountWizardContext> extends AzureWizardExecuteStep<T> {
    private readonly _defaults: INewStorageAccountDefaults;

    public constructor(defaults: INewStorageAccountDefaults) {
        super();
        this._defaults = defaults;
    }

    public async execute(wizardContext: T): Promise<T> {
        if (!wizardContext.storageAccount) {
            // tslint:disable-next-line:no-non-null-assertion
            const newLocation: string = wizardContext.location!.name!;
            // tslint:disable-next-line:no-non-null-assertion
            const newName: string = wizardContext.newStorageAccountName!;
            const newSkuName: string = `${this._defaults.performance}_${this._defaults.replication}`;
            const creatingStorageAccount: string = localize('CreatingStorageAccount', 'Creating storage account "{0}" in location "{1}" with sku "{2}"...', newName, newLocation, newSkuName);
            await window.withProgress({ location: ProgressLocation.Notification, title: creatingStorageAccount }, async (): Promise<void> => {
                ext.outputChannel.appendLine(creatingStorageAccount);
                const storageClient: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscriptionId, wizardContext.environment.resourceManagerEndpointUrl);
                addExtensionUserAgent(storageClient);
                wizardContext.storageAccount = await storageClient.storageAccounts.create(
                    // tslint:disable-next-line:no-non-null-assertion
                    wizardContext.resourceGroup!.name!,
                    newName,
                    {
                        sku: { name: newSkuName },
                        kind: this._defaults.kind,
                        location: newLocation
                    }
                );
                const createdStorageAccount: string = localize('CreatedStorageAccount', 'Successfully created storage account "{0}".', newName);
                window.showInformationMessage(createdStorageAccount);
                ext.outputChannel.appendLine(createdStorageAccount);
            });
        }

        return wizardContext;
    }
}
