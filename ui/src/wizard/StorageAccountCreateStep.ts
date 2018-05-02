/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { OutputChannel } from 'vscode';
import { IStorageAccountCreateOptions, IStorageAccountWizardContext } from '../../index';
import { localize } from '../localize';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';

export class StorageAccountCreateStep<T extends IStorageAccountWizardContext> extends AzureWizardExecuteStep<T> {
    private readonly _createOptions: IStorageAccountCreateOptions;

    public constructor(createOptions: IStorageAccountCreateOptions) {
        super();
        this._createOptions = createOptions;
    }

    public async execute(wizardContext: T, outputChannel: OutputChannel): Promise<T> {
        if (!wizardContext.storageAccount) {
            // tslint:disable-next-line:no-non-null-assertion
            const newLocation: string = wizardContext.location!.name!;
            // tslint:disable-next-line:no-non-null-assertion
            const newName: string = wizardContext.newStorageAccountName!;
            const newSkuName: string = `${this._createOptions.performance}_${this._createOptions.replication}`;
            outputChannel.appendLine(localize('CreatingStorageAccount', 'Creating storage account "{0}" in location "{1}" with sku "{2}"...', newName, newLocation, newSkuName));

            const storageClient: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
            wizardContext.storageAccount = await storageClient.storageAccounts.create(
                // tslint:disable-next-line:no-non-null-assertion
                wizardContext.resourceGroup!.name!,
                newName,
                {
                    sku: { name: newSkuName },
                    kind: this._createOptions.kind,
                    location: newLocation
                }
            );
            outputChannel.appendLine(localize('CreatedStorageAccount', 'Successfully created storage account "{0}".', newName));
        }

        return wizardContext;
    }
}
