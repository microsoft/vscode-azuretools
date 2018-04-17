/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { StorageAccount } from 'azure-arm-storage/lib/models';
import { IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IAzureUserInput, IStorageAccountWizardContext } from '../../index';
import { localize } from '../localize';
import { AzureWizard } from './AzureWizard';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupListStep } from './ResourceGroupListStep';
import { StorageAccountCreateStep } from './StorageAccountCreateStep';
import { StorageAccountNameStep } from './StorageAccountNameStep';

export const storageAccountNamingRules: IAzureNamingRules = {
    minLength: 3,
    maxLength: 24,
    invalidCharsRegExp: /[^a-z0-9]/,
    lowercaseOnly: true
};

export enum StorageAccountKind {
    Storage = 'Storage',
    StorageV2 = 'StorageV2',
    BlobStorage = 'BlobStorage'
}

export enum StorageAccountPerformance {
    Standard = 'Standard',
    Premium = 'Premium'
}

export enum StorageAccountReplication {
    /**
     * Locally redundant storage
     */
    LRS = 'LRS',

    /**
     * Zone-redundant storage
     */
    ZRS = 'ZRS',

    /**
     * Geo-redundant storage
     */
    GRS = 'GRS',

    /**
     * Read-access geo-redundant storage
     */
    RAGRS = 'RAGRS'
}

export class StorageAccountListStep<T extends IStorageAccountWizardContext> extends AzureWizardPromptStep<T> {
    private _kind: StorageAccountKind;
    private _performance: StorageAccountPerformance;
    private _replication: StorageAccountReplication;

    public constructor(kind: StorageAccountKind, performance: StorageAccountPerformance, replication: StorageAccountReplication) {
        super();
        this._kind = kind;
        this._performance = performance;
        this._replication = replication;
    }

    public static async isNameAvailable<T extends IStorageAccountWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const storageClient: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
        return !!(await storageClient.storageAccounts.checkNameAvailability(name)).nameAvailable;
    }

    public async prompt(wizardContext: T, ui: IAzureUserInput): Promise<T> {
        if (!wizardContext.storageAccount) {
            const client: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscriptionId);

            const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select a storage account that supports blobs, queues and tables.', id: `StorageAccountListStep/${wizardContext.subscriptionId}` };
            wizardContext.storageAccount = (await ui.showQuickPick(this.getQuickPicks(client.storageAccounts.list()), quickPickOptions)).data;

            if (wizardContext.storageAccount) {
                // tslint:disable-next-line:no-non-null-assertion
                await LocationListStep.setLocation(wizardContext, wizardContext.storageAccount.location!);
            } else {
                this.subWizard = new AzureWizard(
                    [new StorageAccountNameStep(), new ResourceGroupListStep(), new LocationListStep()],
                    [new StorageAccountCreateStep(this._kind, this._performance, this._replication)],
                    wizardContext
                );
            }
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
}
