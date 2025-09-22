/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ManagedServiceIdentityClient } from '@azure/arm-msi';
import { AzureWizardPromptStep, randomUtils, validationUtils } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import * as types from '../../index';
import { createManagedServiceIdentityClient } from '../clients';

export class UserAssignedIdentityNameStep<T extends types.IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(context: T): Promise<void> {
        let suggestedName: string | undefined;
        const rgName: string | undefined = context.resourceGroup?.name ?? context.newResourceGroupName;

        if (rgName) {
            while (!suggestedName) {
                suggestedName = await UserAssignedIdentityNameStep.tryGenerateRelatedName(context, rgName);
            }
        }

        context.newManagedIdentityName = (await context.ui.showInputBox({
            value: suggestedName,
            prompt: vscode.l10n.t('Enter a name for the new user-assigned identity.'),
            validateInput: this.validateInput,
            asyncValidationTask: (name: string) => this.asyncValidateUserAssignedIdentityAvailable(context, name),
        })).trim();
        context.valuesToMask.push(context.newManagedIdentityName);
    }

    public shouldPrompt(context: T): boolean {
        return !context.newManagedIdentityName;
    }

    private validateInput(name: string = ''): string | undefined {
        name = name.trim();

        const rc: validationUtils.RangeConstraints = { lowerLimitIncl: 3, upperLimitIncl: 128 };
        if (!validationUtils.hasValidCharLength(name, rc)) {
            return validationUtils.getInvalidCharLengthMessage(rc);
        }

        if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(name)) {
            return vscode.l10n.t('The resource name must start with a letter or number, and can only contain a combination of alphanumeric characters, hyphens, and underscores.');
        }

        return undefined;
    }

    private async asyncValidateUserAssignedIdentityAvailable(context: T, rgName: string | undefined, identityName: string = ''): Promise<string | undefined> {
        identityName = identityName.trim();

        if (!rgName) {
            return undefined;
        }

        const isNameAvailable: boolean = await UserAssignedIdentityNameStep.isNameAvailable(context, rgName, identityName);
        return !isNameAvailable ? vscode.l10n.t('User-assigned identity with name "{0}" already exists in resource group "{1}".', identityName, rgName) : undefined;
    }

    static async isNameAvailable(context: types.IResourceGroupWizardContext, rgName: string, identityName: string): Promise<boolean> {
        try {
            const client: ManagedServiceIdentityClient = await createManagedServiceIdentityClient(context);
            return !await client.userAssignedIdentities.get(rgName, identityName);
        } catch {
            return true;
        }
    }

    static async tryGenerateRelatedName(context: types.IResourceGroupWizardContext, rgName: string): Promise<string | undefined> {
        const newName: string = `${rgName}-identities-${randomUtils.getRandomHexString(6)}`;
        const isNameAvailable: boolean = await UserAssignedIdentityNameStep.isNameAvailable(context, rgName, newName);
        return isNameAvailable ? newName : undefined;
    }
}
