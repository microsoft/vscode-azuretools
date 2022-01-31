/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { StorageManagementClient, StorageManagementModels } from '@azure/arm-storage';
import { AzureWizardPromptStep, IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions, openUrl } from 'vscode-azureextensionui';
import * as types from '../../index';
import { createStorageClient } from '../clients';
import { storageProvider } from '../constants';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
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
    BlobStorage = 'BlobStorage',
    BlockBlobStorage = 'BlockBlobStorage'
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
        this._filters = filters || {};
    }

    public static async isNameAvailable<T extends types.IStorageAccountWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const storageClient: StorageManagementClient = await createStorageClient(wizardContext);
        return !!(await storageClient.storageAccounts.checkNameAvailability(name)).nameAvailable;
    }

    public async prompt(wizardContext: T): Promise<void> {
        const client: StorageManagementClient = await createStorageClient(wizardContext);

        const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select a storage account.', id: `StorageAccountListStep/${wizardContext.subscriptionId}` };
        const picksTask: Promise<IAzureQuickPickItem<StorageManagementModels.StorageAccount | undefined>[]> = this.getQuickPicks(wizardContext, client.storageAccounts.list());

        const result: StorageManagementModels.StorageAccount | undefined = (await wizardContext.ui.showQuickPick(picksTask, quickPickOptions)).data;
        wizardContext.storageAccount = result;
        if (wizardContext.storageAccount) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await LocationListStep.setLocation(wizardContext, wizardContext.storageAccount.location!);
        }
    }

    public async getSubWizard(wizardContext: T): Promise<IWizardOptions<T> | undefined> {
        if (!wizardContext.storageAccount) {
            const promptSteps: AzureWizardPromptStep<T>[] = [new StorageAccountNameStep(), new ResourceGroupListStep()];
            LocationListStep.addStep(wizardContext, promptSteps);
            return {
                promptSteps: promptSteps,
                executeSteps: [new StorageAccountCreateStep(this._newAccountDefaults)]
            };
        } else {
            wizardContext.valuesToMask.push(nonNullProp(wizardContext.storageAccount, 'name'));
            return undefined;
        }
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.storageAccount && !wizardContext.newStorageAccountName;
    }

    private async getQuickPicks(wizardContext: T, storageAccountsTask: Promise<StorageManagementModels.StorageAccount[]>): Promise<IAzureQuickPickItem<StorageManagementModels.StorageAccount | undefined>[]> {
        const picks: IAzureQuickPickItem<StorageManagementModels.StorageAccount | undefined>[] = [{
            label: localize('NewStorageAccount', '$(plus) Create new storage account'),
            description: '',
            data: undefined
        }];

        const kindRegExp: RegExp = new RegExp(`^${convertFilterToPattern(this._filters.kind)}$`, 'i');
        const performanceRegExp: RegExp = new RegExp(`^${convertFilterToPattern(this._filters.performance)}_.*$`, 'i');
        const replicationRegExp: RegExp = new RegExp(`^.*_${convertFilterToPattern(this._filters.replication)}$`, 'i');

        let location: types.AzExtLocation | undefined;
        if (LocationListStep.hasLocation(wizardContext)) {
            location = await LocationListStep.getLocation(wizardContext, storageProvider);
        }

        let hasFilteredAccountsBySku: boolean = false;
        let hasFilteredAccountsByLocation: boolean = false;
        const storageAccounts: StorageManagementModels.StorageAccount[] = await storageAccountsTask;
        for (const sa of storageAccounts) {
            if (!sa.kind || sa.kind.match(kindRegExp) || !sa.sku || sa.sku.name.match(performanceRegExp) || sa.sku.name.match(replicationRegExp)) {
                hasFilteredAccountsBySku = true;
                continue;
            }

            if (location && !LocationListStep.locationMatchesName(location, sa.location)) {
                hasFilteredAccountsByLocation = true;
                continue;
            }

            picks.push({
                id: sa.id,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                label: sa.name!,
                description: '',
                data: sa
            });
        }

        if (hasFilteredAccountsBySku && this._filters.learnMoreLink) {
            picks.push({
                label: localize('hasFilteredAccountsBySku', '$(info) Some storage accounts were filtered because of their sku. Learn more...'),
                onPicked: async () => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    await openUrl(this._filters.learnMoreLink!);
                },
                data: undefined
            });
        }

        if (hasFilteredAccountsByLocation && location) {
            picks.push({
                label: localize('hasFilteredAccountsByLocation', '$(warning) Only storage accounts in the region "{0}" are shown.', location.displayName),
                onPicked: () => { /* do nothing */ },
                data: undefined
            });
        }

        return picks;
    }
}

function convertFilterToPattern(values?: string[]): string {
    values ||= [];
    return `(${values.join('|')})`;
}
