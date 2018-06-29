/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { StorageAccount } from 'azure-arm-storage/lib/models';
// tslint:disable-next-line:no-require-imports
import opn = require("opn");
import { isString } from 'util';
import { IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, INewStorageAccountDefaults, IStorageAccountFilters, IStorageAccountWizardContext } from '../../index';
import { addExtensionUserAgentInfo } from '../addExtensionUserAgentInfo';
import { UserCancelledError } from '../errors';
import { ext } from '../extensionVariables';
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
    private readonly _newAccountDefaults: INewStorageAccountDefaults;
    private readonly _filters: IStorageAccountFilters;

    public constructor(newAccountDefaults: INewStorageAccountDefaults, filters?: IStorageAccountFilters) {
        super();
        this._newAccountDefaults = newAccountDefaults;
        // tslint:disable-next-line:strict-boolean-expressions
        this._filters = filters || {};
    }

    public static async isNameAvailable<T extends IStorageAccountWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const storageClient: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
        return !!(await storageClient.storageAccounts.checkNameAvailability(name)).nameAvailable;
    }

    public async prompt(wizardContext: T): Promise<T> {
        if (!wizardContext.storageAccount && !wizardContext.newStorageAccountName) {
            const client: StorageManagementClient = new StorageManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
            addExtensionUserAgentInfo(client);

            const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select a storage account.', id: `StorageAccountListStep/${wizardContext.subscriptionId}` };
            const result: StorageAccount | string | undefined = (await ext.ui.showQuickPick(this.getQuickPicks(client.storageAccounts.list()), quickPickOptions)).data;
            // If result is a string, that means the user selected the 'Learn more...' pick
            if (isString(result)) {
                // tslint:disable-next-line:no-floating-promises
                opn(result);
                throw new UserCancelledError();
            }

            wizardContext.storageAccount = result;
            if (wizardContext.storageAccount) {
                // tslint:disable-next-line:no-non-null-assertion
                await LocationListStep.setLocation(wizardContext, wizardContext.storageAccount.location!);
            } else {
                this.subWizard = new AzureWizard(
                    [new StorageAccountNameStep(), new ResourceGroupListStep(), new LocationListStep()],
                    [new StorageAccountCreateStep(this._newAccountDefaults)],
                    wizardContext
                );
            }
        }

        return wizardContext;
    }

    private async getQuickPicks(storageAccountsTask: Promise<StorageAccount[]>): Promise<IAzureQuickPickItem<StorageAccount | string | undefined>[]> {
        const picks: IAzureQuickPickItem<StorageAccount | string | undefined>[] = [{
            label: localize('NewStorageAccount', '$(plus) Create new storage account'),
            description: '',
            data: undefined
        }];

        const kindRegExp: RegExp = new RegExp(`^${convertFilterToPattern(this._filters.kind)}$`, 'i');
        const performanceRegExp: RegExp = new RegExp(`^${convertFilterToPattern(this._filters.performance)}_.*$`, 'i');
        const replicationRegExp: RegExp = new RegExp(`^.*_${convertFilterToPattern(this._filters.replication)}$`, 'i');

        let hasFilteredAccounts: boolean = false;
        const storageAccounts: StorageAccount[] = await storageAccountsTask;
        for (const sa of storageAccounts) {
            // tslint:disable:strict-boolean-expressions
            if (!sa.kind || sa.kind.match(kindRegExp) || !sa.sku || sa.sku.name.match(performanceRegExp) || sa.sku.name.match(replicationRegExp)) {
                // tslint:enable:strict-boolean-expressions
                hasFilteredAccounts = true;
                continue;
            }

            picks.push({
                id: sa.id,
                // tslint:disable-next-line:no-non-null-assertion
                label: sa.name!,
                description: '',
                data: sa
            });
        }

        if (hasFilteredAccounts && this._filters.learnMoreLink) {
            picks.push({
                label: localize('filtered', '$(info) Some storage accounts were filtered. Learn more...'),
                description: '',
                suppressPersistence: true,
                data: this._filters.learnMoreLink
            });
        }

        return picks;
    }
}

function convertFilterToPattern(values?: string[]): string {
    // tslint:disable-next-line:strict-boolean-expressions
    values = values || [];
    return `(${values.join('|')})`;
}
