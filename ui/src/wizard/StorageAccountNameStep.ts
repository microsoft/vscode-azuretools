/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient, StorageManagementModels } from '@azure/arm-storage';
import * as types from '../../index';
import { createAzureClient } from '../createAzureClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzureNameStep } from './AzureNameStep';
import { ResourceGroupListStep, resourceGroupNamingRules } from './ResourceGroupListStep';
import { storageAccountNamingRules } from './StorageAccountListStep';

export class StorageAccountNameStep<T extends types.IStorageAccountWizardContext> extends AzureNameStep<T> {
    public async prompt(wizardContext: T): Promise<void> {
        const client: StorageManagementClient = createAzureClient(wizardContext, StorageManagementClient);

        const suggestedName: string | undefined = wizardContext.relatedNameTask ? await wizardContext.relatedNameTask : undefined;
        wizardContext.newStorageAccountName = (await ext.ui.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new storage account.',
            validateInput: async (value: string): Promise<string | undefined> => await this.validateStorageAccountName(client, value)
        })).trim();

        if (!wizardContext.relatedNameTask) {
            wizardContext.relatedNameTask = this.generateRelatedName(wizardContext, wizardContext.newStorageAccountName, resourceGroupNamingRules);
        }
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.newStorageAccountName;
    }

    protected async isRelatedNameAvailable(wizardContext: T, name: string): Promise<boolean> {
        return await ResourceGroupListStep.isNameAvailable(wizardContext, name);
    }

    private async validateStorageAccountName(client: StorageManagementClient, name: string): Promise<string | undefined> {
        name = name.trim();

        if (!name || name.length < storageAccountNamingRules.minLength || name.length > storageAccountNamingRules.maxLength) {
            return localize('invalidLength', 'The name must be between {0} and {1} characters.', storageAccountNamingRules.minLength, storageAccountNamingRules.maxLength);
        } else if (name.match(storageAccountNamingRules.invalidCharsRegExp) !== null) {
            return localize('invalidChars', "The name can only contain lowercase letters and numbers.");
        } else {
            const nameAvailabilityResult: StorageManagementModels.CheckNameAvailabilityResult = await client.storageAccounts.checkNameAvailability(name);
            if (!nameAvailabilityResult.nameAvailable) {
                return nameAvailabilityResult.message;
            } else {
                return undefined;
            }
        }
    }
}
