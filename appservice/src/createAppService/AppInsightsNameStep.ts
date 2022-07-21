/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ApplicationInsightsComponent } from '@azure/arm-appinsights';
import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import { localize } from '../localize';
import { AppInsightsListStep, appInsightsNamingRules } from './AppInsightsListStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppInsightsNameStep extends AzureWizardPromptStep<IAppServiceWizardContext> {

    public async isNameAvailable(context: IAppServiceWizardContext, name: string): Promise<boolean> {
        const appInsightsComponents: ApplicationInsightsComponent[] = await AppInsightsListStep.getAppInsightsComponents(context);
        return !appInsightsComponents.some((ai: ApplicationInsightsComponent) => ai.name !== undefined && ai.name.toLowerCase() === name.toLowerCase());
    }

    public async prompt(context: IAppServiceWizardContext): Promise<void> {
        const suggestedName: string | undefined = context.relatedNameTask ? await context.relatedNameTask : undefined;
        context.newAppInsightsName = (await context.ui.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new Application Insights resource.',
            validateInput: async (value: string): Promise<string | undefined> => await this.validateApplicationInsightName(context, value)
        })).trim();
        context.valuesToMask.push(context.newAppInsightsName);
    }

    public shouldPrompt(context: IAppServiceWizardContext): boolean {
        return !context.newAppInsightsName;
    }

    private async validateApplicationInsightName(context: IAppServiceWizardContext, name: string): Promise<string | undefined> {
        name = name.trim();

        if (name.length < appInsightsNamingRules.minLength || name.length > appInsightsNamingRules.maxLength) {
            return localize('invalidLength', 'The name must be between {0} and {1} characters.', appInsightsNamingRules.minLength, appInsightsNamingRules.maxLength);
        } else if (appInsightsNamingRules.invalidCharsRegExp.test(name)) {
            return localize('invalidChars', "The name can only contain alphanumeric characters or the symbols ._-()");
        } else if (name.endsWith('.')) {
            return localize('invalidEndingChar', "The name cannot end in a period.");
        } else if (!await this.isNameAvailable(context, name)) {
            return localize('nameAlreadyExists', 'Application Insights resource "{0}" already exists in subscription "{1}".', name, context.subscriptionDisplayName);
        } else {
            return undefined;
        }
    }
}
