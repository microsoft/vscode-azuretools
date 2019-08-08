/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AppInsightsListStep, appInsightsNamingRules } from './AppInsightsListStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsNameStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        const suggestedName: string | undefined = wizardContext.relatedNameTask ? await wizardContext.relatedNameTask : undefined;
        wizardContext.newAppInsightsName = (await ext.ui.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new application insight component.',
            validateInput: async (value: string | undefined): Promise<string | undefined> => await this.validateApplicationInsightName(wizardContext, value)
        })).trim();
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.newAppInsightsName;
    }

    private async validateApplicationInsightName(wizardContext: IAppServiceWizardContext, name: string | undefined): Promise<string | undefined> {
        name = name ? name.trim() : '';

        if (name.length < appInsightsNamingRules.minLength || name.length > appInsightsNamingRules.maxLength) {
            return localize('invalidLength', 'The name must be between {0} and {1} characters.', appInsightsNamingRules.minLength, appInsightsNamingRules.maxLength);
        } else if (name.match(appInsightsNamingRules.invalidCharsRegExp) !== null) {
            return localize('invalidChars', "The name can only contain alphanumeric characters or the symbols ._-()");
        } else if (name.endsWith('.')) {
            return localize('invalidEndingChar', "The name cannot end in a period.");
        } else if (!await AppInsightsListStep.isNameAvailable(wizardContext, name)) {
            return localize('nameAlreadyExists', 'Application insights component "{0}" already exists in subscription "{1}".', name, wizardContext.subscriptionDisplayName);
        } else {
            return undefined;
        }
    }
}
