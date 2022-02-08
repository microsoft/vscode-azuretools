/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SkuName, StorageManagementClient } from '@azure/arm-storage';
import { Progress } from 'vscode';
import * as types from '../../index';
import { createStorageClient } from '../clients';
import { storageProvider } from '../constants';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';
import { LocationListStep } from './LocationListStep';

export class StorageAccountCreateStep<T extends types.IStorageAccountWizardContext> extends AzureWizardExecuteStep<T> implements types.StorageAccountCreateStep<T> {
    public priority: number = 130;

    private readonly _defaults: types.INewStorageAccountDefaults;

    public constructor(defaults: types.INewStorageAccountDefaults) {
        super();
        this._defaults = defaults;
    }

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const newLocation: string = (await LocationListStep.getLocation(wizardContext, storageProvider)).name;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const newName: string = wizardContext.newStorageAccountName!;
        const newSkuName: SkuName = <SkuName>`${this._defaults.performance}_${this._defaults.replication}`;
        const creatingStorageAccount: string = localize('CreatingStorageAccount', 'Creating storage account "{0}" in location "{1}" with sku "{2}"...', newName, newLocation, newSkuName);
        ext.outputChannel.appendLog(creatingStorageAccount);
        progress.report({ message: creatingStorageAccount });
        const storageClient: StorageManagementClient = await createStorageClient(wizardContext);
        wizardContext.storageAccount = await storageClient.storageAccounts.beginCreateAndWait(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            wizardContext.resourceGroup!.name!,
            newName,
            {
                sku: { name: newSkuName },
                kind: this._defaults.kind,
                location: newLocation,
                enableHttpsTrafficOnly: true
            }
        );
        const createdStorageAccount: string = localize('CreatedStorageAccount', 'Successfully created storage account "{0}".', newName);
        ext.outputChannel.appendLog(createdStorageAccount);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.storageAccount;
    }
}
