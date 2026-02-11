/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { NetworkRuleSet, StorageAccount } from '@azure/arm-storage';
import { AzureWizardPromptStep, IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions, nonNullProp, openUrl } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { INewStorageAccountDefaults, IStorageAccountWizardContext } from './storageWizardTypes';
import { createStorageClient } from '../clients';
import { storageProvider, storageProviderType } from '../constants';
import { uiUtils } from '../utils/uiUtils';
import { AzExtLocation, LocationListStep } from './LocationListStep';
import { ResourceGroupListStep } from './ResourceGroupListStep';
import { StorageAccountCreateStep } from './StorageAccountCreateStep';
import { StorageAccountNameStep } from './StorageAccountNameStep';

export const storageAccountNamingRules: IAzureNamingRules = {
    minLength: 3,
    maxLength: 24,
    invalidCharsRegExp: /[^a-z0-9]/,
    lowercaseOnly: true
};

export { StorageAccountKind, StorageAccountPerformance, StorageAccountReplication } from './storageWizardTypes';
import { StorageAccountKind, StorageAccountPerformance, StorageAccountReplication } from './storageWizardTypes';

export interface IStorageAccountFilters {
    kind?: StorageAccountKind[];
    performance?: StorageAccountPerformance[];
    replication?: StorageAccountReplication[];

    /**
     * If specified, a 'learn more' option will be displayed to explain why some storage accounts were filtered
     */
    learnMoreLink?: string;
}

export class StorageAccountListStep<T extends IStorageAccountWizardContext> extends AzureWizardPromptStep<T> {
    private readonly _newAccountDefaults: INewStorageAccountDefaults;
    private readonly _filters: IStorageAccountFilters;

    /**
     * @param createOptions Default options to use when creating a Storage Account
     * @param filterOptions Optional filters used when listing Storage Accounts
     */
    public constructor(newAccountDefaults: INewStorageAccountDefaults, filters?: IStorageAccountFilters) {
        super();
        this._newAccountDefaults = newAccountDefaults;
        this._filters = filters ?? {};
    }

    public static async isNameAvailable<T extends IStorageAccountWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const storageClient = await createStorageClient(wizardContext);
        return !!(await storageClient.storageAccounts.checkNameAvailability({ name, type: storageProviderType })).nameAvailable;
    }

    public async prompt(wizardContext: T): Promise<void> {
        const client = await createStorageClient(wizardContext);

        const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select a storage account.', id: `StorageAccountListStep/${wizardContext.subscriptionId}` };
        const picksTask: Promise<IAzureQuickPickItem<StorageAccount | undefined>[]> = this.getQuickPicks(wizardContext, uiUtils.listAllIterator(client.storageAccounts.list()));

        const result: StorageAccount | undefined = (await wizardContext.ui.showQuickPick(picksTask, quickPickOptions)).data;
        wizardContext.storageAccount = result;
        if (wizardContext.storageAccount) {
            await LocationListStep.setLocation(wizardContext, wizardContext.storageAccount.location);
        }
    }

    public async getSubWizard(wizardContext: T): Promise<IWizardOptions<T> | undefined> {
        if (!wizardContext.storageAccount) {
            const promptSteps: AzureWizardPromptStep<T>[] = [new StorageAccountNameStep(), new ResourceGroupListStep()];
            LocationListStep.addStep(wizardContext, promptSteps);
            return Promise.resolve({
                promptSteps: promptSteps,
                executeSteps: [new StorageAccountCreateStep(this._newAccountDefaults)]
            });
        } else {
            wizardContext.valuesToMask.push(nonNullProp(wizardContext.storageAccount, 'name'));
            return Promise.resolve(undefined);
        }
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.storageAccount && !wizardContext.newStorageAccountName;
    }

    private async getQuickPicks(wizardContext: T, storageAccountsTask: Promise<StorageAccount[]>): Promise<IAzureQuickPickItem<StorageAccount | undefined>[]> {
        const picks: IAzureQuickPickItem<StorageAccount | undefined>[] = [{
            label: vscode.l10n.t('$(plus) Create new storage account'),
            description: '',
            data: undefined
        }];

        const kindRegExp: RegExp = new RegExp(`^${convertFilterToPattern(this._filters.kind)}$`, 'i');
        const performanceRegExp: RegExp = new RegExp(`^${convertFilterToPattern(this._filters.performance)}_.*$`, 'i');
        const replicationRegExp: RegExp = new RegExp(`^.*_${convertFilterToPattern(this._filters.replication)}$`, 'i');

        let location: AzExtLocation | undefined;
        if (LocationListStep.hasLocation(wizardContext)) {
            location = await LocationListStep.getLocation(wizardContext, storageProvider);
        }

        let hasFilteredAccountsBySku: boolean = false;
        let hasFilteredAccountsByLocation: boolean = false;
        let hasFilteredAccountsByNetwork = false;
        const storageAccounts: (StorageAccount & { networkAcls?: NetworkRuleSet })[] = (await storageAccountsTask)
            .sort((a: StorageAccount, b: StorageAccount) => nonNullProp(a, 'name').localeCompare(nonNullProp(b, 'name')));
        for (const sa of storageAccounts) {
            if (!sa.kind || sa.kind.match(kindRegExp) || !sa.sku || sa.sku.name.match(performanceRegExp) || sa.sku.name.match(replicationRegExp)) {
                hasFilteredAccountsBySku = true;
                continue;
            }

            if (location && !LocationListStep.locationMatchesName(location, sa.location)) {
                hasFilteredAccountsByLocation = true;
                continue;
            }

            // old storage accounts (and the typings) use `networkRuleSet` but newer storage accounts have `networkAcls`
            const networkDefaultAction = sa.networkRuleSet?.defaultAction ?? sa.networkAcls?.defaultAction;
            if (sa.publicNetworkAccess?.toLocaleLowerCase() === 'disabled' ||
                sa.publicNetworkAccess?.toLocaleLowerCase() === 'enabled' && networkDefaultAction === 'Deny') {
                hasFilteredAccountsByNetwork = true;
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
                label: vscode.l10n.t('$(info) Some storage accounts were filtered because of their sku. Learn more...'),
                onPicked: async () => {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    await openUrl(this._filters.learnMoreLink!);
                },
                data: undefined
            });
        }

        if (hasFilteredAccountsByLocation && location) {
            picks.push({
                label: vscode.l10n.t('$(warning) Only storage accounts in the region "{0}" are shown.', location.displayName),
                onPicked: () => { /* do nothing */ },
                data: undefined
            });
        }

        if (hasFilteredAccountsByNetwork) {
            picks.push({
                label: vscode.l10n.t('$(warning) Some storage accounts were filtered because of their network configurations.'),
                onPicked: () => { /* do nothing */ },
                data: undefined
            });
        }


        return picks;
    }
}

function convertFilterToPattern(values?: string[]): string {
    values ??= [];
    return `(${values.join('|')})`;
}
