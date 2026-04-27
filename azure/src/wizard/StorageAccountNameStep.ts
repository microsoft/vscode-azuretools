/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { StorageManagementClient } from '@azure/arm-storage';
import { AzureNameStep } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import * as types from '../../index';
import { createStorageClient } from '../clients';
import { storageProviderType } from '../constants';
import { ResourceGroupListStep, resourceGroupNamingRules } from './ResourceGroupListStep';
import { storageAccountNamingRules } from './StorageAccountListStep';

export class StorageAccountNameStep<T extends types.IStorageAccountWizardContext> extends AzureNameStep<T> {
    public async prompt(wizardContext: T): Promise<void> {
        const client = await createStorageClient(wizardContext);

        const suggestedName: string | undefined = wizardContext.relatedNameTask ? await wizardContext.relatedNameTask : undefined;
        wizardContext.newStorageAccountName = (await wizardContext.ui.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new storage account.',
            validateInput: (value: string): string | undefined => this.validateStorageAccountNameSync(value),
            asyncValidationTask: async (value: string): Promise<string | undefined> => await this.validateStorageAccountNameAvailability(client, value)
        })).trim();

        wizardContext.relatedNameTask ??= this.generateRelatedName(wizardContext, wizardContext.newStorageAccountName, resourceGroupNamingRules);
        wizardContext.valuesToMask.push(wizardContext.newStorageAccountName);
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.newStorageAccountName;
    }

    protected async isRelatedNameAvailable(wizardContext: T, name: string): Promise<boolean> {
        return await ResourceGroupListStep.isNameAvailable(wizardContext, name);
    }

    private validateStorageAccountNameSync(name: string): string | undefined {
        name = name.trim();
        if (!name || name.length < storageAccountNamingRules.minLength || name.length > storageAccountNamingRules.maxLength) {
            return vscode.l10n.t('The name must be between {0} and {1} characters.', storageAccountNamingRules.minLength, storageAccountNamingRules.maxLength);
        } else if (name.match(storageAccountNamingRules.invalidCharsRegExp) !== null) {
            return vscode.l10n.t("The name can only contain lowercase letters and numbers.");
        }
        return undefined;
    }

    private async validateStorageAccountNameAvailability(client: StorageManagementClient, name: string): Promise<string | undefined> {
        // Reuse the synchronous validator to keep validation rules centralized.
        const syncValidationResult: string | undefined = this.validateStorageAccountNameSync(name);
        if (syncValidationResult !== undefined) {
            // The sync validator will surface the error message; skip availability check.
            return undefined;
        }

        const trimmedName: string = name.trim();
        const nameAvailabilityResult = await client.storageAccounts.checkNameAvailability({ name: trimmedName, type: storageProviderType });
        if (!nameAvailabilityResult.nameAvailable) {
            return nameAvailabilityResult.message;
        }
        return undefined;
    }
}
