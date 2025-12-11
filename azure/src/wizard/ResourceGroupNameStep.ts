/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import * as types from '../../index';
import { ResourceGroupListStep, resourceGroupNamingRules } from './ResourceGroupListStep';

export class ResourceGroupNameStep<T extends types.IResourceGroupWizardContext> extends AzureWizardPromptStep<T> implements types.ResourceGroupNameStep<T> {
    public async prompt(wizardContext: T): Promise<void> {
        const suggestedName: string | undefined = wizardContext.relatedNameTask ? await wizardContext.relatedNameTask : undefined;
        wizardContext.newResourceGroupName = (await wizardContext.ui.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new resource group.',
            validateInput: (name) => this.validateResourceGroupName(name),
            asyncValidationTask: (name: string): Promise<string | undefined> => this.asyncValidateResourceGroupAvailable(wizardContext, name),
        })).trim();
        wizardContext.valuesToMask.push(wizardContext.newResourceGroupName);
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.newResourceGroupName;
    }

    private validateResourceGroupName(name: string): string | undefined {
        name = name.trim();

        if (name.length < resourceGroupNamingRules.minLength || name.length > resourceGroupNamingRules.maxLength) {
            return vscode.l10n.t('The name must be between {0} and {1} characters.', resourceGroupNamingRules.minLength, resourceGroupNamingRules.maxLength);
        } else if (name.match(resourceGroupNamingRules.invalidCharsRegExp) !== null) {
            return vscode.l10n.t("The name can only contain alphanumeric characters or the symbols ._-()");
        } else if (name.endsWith('.')) {
            return vscode.l10n.t("The name cannot end in a period.");
        } else {
            return undefined;
        }
    }

    private async asyncValidateResourceGroupAvailable(context: T, name: string): Promise<string | undefined> {
        name = name.trim();
        return !await ResourceGroupListStep.isNameAvailable(context, name) ?
            vscode.l10n.t('Resource group "{0}" already exists in subscription "{1}".', name, context.subscriptionDisplayName) : undefined;
    }
}
