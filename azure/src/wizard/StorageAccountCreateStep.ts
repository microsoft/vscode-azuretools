/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SkuName, StorageManagementClient } from '@azure/arm-storage';
import { AzureWizardExecuteStep, IAzureNamingRules } from '@microsoft/vscode-azext-utils';
import { Progress } from 'vscode';
import * as types from '../../index';
import { createStorageClient } from '../clients';
import { storageProvider } from '../constants';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { randomUtils } from '../utils/randomUtils';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupListStep } from './ResourceGroupListStep';
import { storageAccountNamingRules } from './StorageAccountListStep';

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
        const newName = await this.generateRelatedName(wizardContext, wizardContext.newStorageAccountName!, storageAccountNamingRules) as string;
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

    protected async generateRelatedName(wizardContext: T, name: string, namingRules: IAzureNamingRules | IAzureNamingRules[]): Promise<string | undefined> {
        if (!Array.isArray(namingRules)) {
            namingRules = [namingRules];
        }

        let preferredName: string = namingRules.some((n: IAzureNamingRules) => !!n.lowercaseOnly) ? name.toLowerCase() : name;

        for (let invalidCharsRegExp of namingRules.map((n: IAzureNamingRules) => n.invalidCharsRegExp)) {
            // Ensure the regExp uses the 'g' flag to replace _all_ invalid characters
            invalidCharsRegExp = new RegExp(invalidCharsRegExp, 'g');
            preferredName = preferredName.replace(invalidCharsRegExp, '');
        }

        const minLength: number = Math.max(...namingRules.map((n: IAzureNamingRules) => n.minLength));
        const maxLength: number = Math.min(...namingRules.map((n: IAzureNamingRules) => n.maxLength));

        const maxTries: number = 5;
        let count: number = 0;
        let newName: string;
        while (count < maxTries) {
            newName = this.generateSuffixedName(preferredName, minLength, maxLength);
            if (await this.isRelatedNameAvailable(wizardContext, newName)) {
                return newName;
            }
            count += 1;
        }

        return undefined;
    }

    protected async isRelatedNameAvailable(wizardContext: T, name: string): Promise<boolean> {
        return await ResourceGroupListStep.isNameAvailable(wizardContext, name);
    }

    private generateSuffixedName(preferredName: string, minLength: number, maxLength: number): string {
        const suffix: string = randomUtils.getRandomHexString();
        const minUnsuffixedLength: number = minLength - suffix.length;
        const maxUnsuffixedLength: number = maxLength - suffix.length;

        let unsuffixedName: string = preferredName;
        if (unsuffixedName.length > maxUnsuffixedLength) {
            unsuffixedName = preferredName.slice(0, maxUnsuffixedLength);
        } else {
            while (unsuffixedName.length < minUnsuffixedLength) {
                unsuffixedName += preferredName;
            }
        }

        return unsuffixedName + suffix;
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.storageAccount;
    }
}
