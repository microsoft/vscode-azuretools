/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import { StorageManagementClient } from '@azure/arm-storage';
import { SkuName } from '@azure/arm-storage/esm/models';
import { Progress } from 'vscode';
import * as types from '../../index';
import { createAzureClient } from '../createAzureClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';

export class StorageAccountCreateStep<T extends types.IStorageAccountWizardContext> extends AzureWizardExecuteStep<T> implements types.StorageAccountCreateStep<T> {
    public priority: number = 130;

    private readonly _defaults: types.INewStorageAccountDefaults;

    public constructor(defaults: types.INewStorageAccountDefaults) {
        super();
        this._defaults = defaults;
    }

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        // tslint:disable-next-line:no-non-null-assertion
        const newLocation: string = wizardContext.location!.name!;
        // tslint:disable-next-line:no-non-null-assertion
        const newName: string = wizardContext.newStorageAccountName!;
        const newSkuName: SkuName = <SkuName>`${this._defaults.performance}_${this._defaults.replication}`;
        const creatingStorageAccount: string = localize('CreatingStorageAccount', 'Creating storage account "{0}" in location "{1}" with sku "{2}"...', newName, newLocation, newSkuName);
        ext.outputChannel.appendLine(creatingStorageAccount);
        progress.report({ message: creatingStorageAccount });
        const storageClient: StorageManagementClient = createAzureClient(wizardContext, StorageManagementClient);
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
        ext.outputChannel.appendLine(createdStorageAccount);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.storageAccount;
    }
}
