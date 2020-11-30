/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { localize } from '../localize';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';
import { ResourceGroupListStep, resourceGroupNamingRules } from './ResourceGroupListStep';

export class ResourceGroupNameStep<T extends types.IResourceGroupWizardContext> extends AzureWizardPromptStep<T> implements types.ResourceGroupNameStep<T> {
    public async prompt(wizardContext: T): Promise<void> {
        const suggestedName: string | undefined = wizardContext.relatedNameTask ? await wizardContext.relatedNameTask : undefined;
        wizardContext.newResourceGroupName = (await wizardContext.ui.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new resource group.',
            validateInput: async (value: string): Promise<string | undefined> => await this.validateResourceGroupName(wizardContext, value)
        })).trim();
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.newResourceGroupName;
    }

    private async validateResourceGroupName(wizardContext: T, name: string): Promise<string | undefined> {
        name = name.trim();

        if (name.length < resourceGroupNamingRules.minLength || name.length > resourceGroupNamingRules.maxLength) {
            return localize('invalidLength', 'The name must be between {0} and {1} characters.', resourceGroupNamingRules.minLength, resourceGroupNamingRules.maxLength);
        } else if (name.match(resourceGroupNamingRules.invalidCharsRegExp) !== null) {
            return localize('invalidChars', "The name can only contain alphanumeric characters or the symbols ._-()");
        } else if (name.endsWith('.')) {
            return localize('invalidEndingChar', "The name cannot end in a period.");
        } else if (!await ResourceGroupListStep.isNameAvailable(wizardContext, name)) {
            return localize('nameAlreadyExists', 'Resource group "{0}" already exists in subscription "{1}".', name, wizardContext.subscriptionDisplayName);
        } else {
            return undefined;
        }
    }
}
