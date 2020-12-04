/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureNamingRules } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export const appServicePlanNamingRules: IAzureNamingRules = {
    minLength: 1,
    maxLength: 40,
    invalidCharsRegExp: /[^a-zA-Z0-9\-_]/
};

export class AppServicePlanNameStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        wizardContext.newPlanName = (await wizardContext.ui.showInputBox({
            value: await wizardContext.relatedNameTask,
            prompt: localize('AppServicePlanPrompt', 'Enter the name of the new App Service plan.'),
            validateInput: async (value: string): Promise<string | undefined> => await this.validatePlanName(wizardContext, value)
        })).trim();
        wizardContext.valuesToMask.push(wizardContext.newPlanName);
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.newPlanName;
    }

    private async validatePlanName(wizardContext: IAppServiceWizardContext, name: string): Promise<string | undefined> {
        name = name.trim();

        if (name.length < appServicePlanNamingRules.minLength || name.length > appServicePlanNamingRules.maxLength) {
            return localize('invalidLength', 'The name must be between {0} and {1} characters.', appServicePlanNamingRules.minLength, appServicePlanNamingRules.maxLength);
        } else if (appServicePlanNamingRules.invalidCharsRegExp.test(name)) {
            return localize('invalidChars', "The name can only contain alphanumeric characters, hyphens, and underscores.");
        } else if (wizardContext.resourceGroup && !await AppServicePlanListStep.isNameAvailable(wizardContext, name, nonNullProp(wizardContext.resourceGroup, 'name'))) {
            return localize('nameAlreadyExists', 'App Service plan "{0}" already exists in resource group "{1}".', name, wizardContext.resourceGroup.name);
        } else {
            return undefined;
        }
    }
}
