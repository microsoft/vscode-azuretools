/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsManagementClient } from "azure-arm-appinsights";
import { ApplicationInsightsComponent, ApplicationInsightsComponentListResult } from "azure-arm-appinsights/lib/models";
import { AzureWizardPromptStep, createAzureClient, IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { nonNullProp } from "../utils/nonNull";
import { AppInsightsCreateStep } from "./AppInsightsCreateStep";
import { AppInsightsNameStep } from "./AppInsightsNameStep";
import { IAppServiceWizardContext } from "./IAppServiceWizardContext";

export const appInsightsNamingRules: IAzureNamingRules = {
    minLength: 1,
    maxLength: 255,
    invalidCharsRegExp: /[^a-zA-Z0-9\.\_\-\(\)]/
};

const skipForNowLabel: string = '$(clock) Skip for now';

export class AppInsightsListStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public static async getAppInsightsComponents(wizardContext: IAppServiceWizardContext): Promise<ApplicationInsightsComponentListResult> {
        if (wizardContext.appInsightsTask === undefined) {
            const client: ApplicationInsightsManagementClient = createAzureClient(wizardContext, ApplicationInsightsManagementClient);
            wizardContext.appInsightsTask = client.components.list();
        }

        return await wizardContext.appInsightsTask;
    }

    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        const options: IAzureQuickPickOptions = { placeHolder: 'Select an Application Insights resource for your app.', id: `AppInsightsListStep/${wizardContext.subscriptionId}` };
        const input: IAzureQuickPickItem<ApplicationInsightsComponent | undefined> = (await ext.ui.showQuickPick(this.getQuickPicks(wizardContext), options));
        wizardContext.appInsightsComponent = input.data;

        // as create new and skipForNow both have undefined as the data type, check the label
        if (input.label === skipForNowLabel) {
            wizardContext.telemetry.properties.skipForNow = 'true';
            wizardContext.appInsightsSkip = true;
        }
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.appInsightsComponent;
    }

    public async getSubWizard(wizardContext: IAppServiceWizardContext): Promise<IWizardOptions<IAppServiceWizardContext> | undefined> {
        if (!wizardContext.appInsightsComponent && !wizardContext.appInsightsSkip) {
            return {
                promptSteps: [new AppInsightsNameStep()],
                executeSteps: [new AppInsightsCreateStep()]
            };
        } else {
            return undefined;
        }
    }

    private async getQuickPicks(wizardContext: IAppServiceWizardContext): Promise<IAzureQuickPickItem<ApplicationInsightsComponent | undefined>[]> {

        const picks: IAzureQuickPickItem<ApplicationInsightsComponent | undefined>[] = [{
            label: localize('newApplicationInsight', '$(plus) Create new Application Insights resource'),
            data: undefined
        },
        {
            label: localize('skipForNow', skipForNowLabel),
            data: undefined
        }];

        const applicationInsights: ApplicationInsightsComponentListResult = await AppInsightsListStep.getAppInsightsComponents(wizardContext);
        return picks.concat(applicationInsights.map((ai: ApplicationInsightsComponent) => {
            return {
                id: ai.id,
                label: nonNullProp(ai, 'name'),
                description: ai.location,
                data: ai
            };
        }));
    }
}
