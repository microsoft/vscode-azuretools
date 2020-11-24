/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient, StorageManagementModels } from '@azure/arm-storage';
import { isString } from 'util';
import * as types from '../../index';
import { createStorageClient } from '../clients';
import { localize } from '../localize';
import { openUrl } from '../utils/openUrl';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupListStep } from './ResourceGroupListStep';
import { StorageAccountCreateStep } from './StorageAccountCreateStep';
import { StorageAccountNameStep } from './StorageAccountNameStep';

export const storageAccountNamingRules: types.IAzureNamingRules = {
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

export class StorageAccountListStep<T extends types.IStorageAccountWizardContext> extends AzureWizardPromptStep<T> implements types.StorageAccountListStep<T> {
    private readonly _newAccountDefaults: types.INewStorageAccountDefaults;
    private readonly _filters: types.IStorageAccountFilters;

    public constructor(newAccountDefaults: types.INewStorageAccountDefaults, filters?: types.IStorageAccountFilters) {
        super();
        this._newAccountDefaults = newAccountDefaults;
        // tslint:disable-next-line:strict-boolean-expressions
        this._filters = filters || {};
    }

    public static async isNameAvailable<T extends types.IStorageAccountWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const storageClient: StorageManagementClient = await createStorageClient(wizardContext);
        return !!(await storageClient.storageAccounts.checkNameAvailability(name)).nameAvailable;
    }

    public async prompt(wizardContext: T): Promise<void> {
        const client: StorageManagementClient = await createStorageClient(wizardContext);

        const quickPickOptions: types.IAzureQuickPickOptions = { placeHolder: 'Select a storage account.', id: `StorageAccountListStep/${wizardContext.subscriptionId}` };
        const picksTask: Promise<types.IAzureQuickPickItem<StorageManagementModels.StorageAccount | string | undefined>[]> = this.getQuickPicks(client.storageAccounts.list());

        let result: StorageManagementModels.StorageAccount | string | undefined;
        do {
            result = (await wizardContext.ui.showQuickPick(picksTask, quickPickOptions)).data;
            // If result is a string, that means the user selected the 'Learn more...' pick
            if (isString(result)) {
                await openUrl(result);
            }
        } while (isString(result));

        wizardContext.storageAccount = result;
        if (wizardContext.storageAccount) {
            // tslint:disable-next-line:no-non-null-assertion
            await LocationListStep.setLocation(wizardContext, wizardContext.storageAccount.location!);
        }
    }

    public async getSubWizard(wizardContext: T): Promise<types.IWizardOptions<T> | undefined> {
        if (!wizardContext.storageAccount) {
            const promptSteps: AzureWizardPromptStep<T>[] = [new StorageAccountNameStep(), new ResourceGroupListStep()];
            LocationListStep.addStep(wizardContext, promptSteps);
            return {
                promptSteps: promptSteps,
                executeSteps: [new StorageAccountCreateStep(this._newAccountDefaults)]
            };
        } else {
            return undefined;
        }
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.storageAccount && !wizardContext.newStorageAccountName;
    }

    private async getQuickPicks(storageAccountsTask: Promise<StorageManagementModels.StorageAccount[]>): Promise<types.IAzureQuickPickItem<StorageManagementModels.StorageAccount | string | undefined>[]> {
        const picks: types.IAzureQuickPickItem<StorageManagementModels.StorageAccount | string | undefined>[] = [{
            label: localize('NewStorageAccount', '$(plus) Create new storage account'),
            description: '',
            data: undefined
        }];

        const kindRegExp: RegExp = new RegExp(`^${convertFilterToPattern(this._filters.kind)}$`, 'i');
        const performanceRegExp: RegExp = new RegExp(`^${convertFilterToPattern(this._filters.performance)}_.*$`, 'i');
        const replicationRegExp: RegExp = new RegExp(`^.*_${convertFilterToPattern(this._filters.replication)}$`, 'i');

        let hasFilteredAccounts: boolean = false;
        const storageAccounts: StorageManagementModels.StorageAccount[] = await storageAccountsTask;
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
