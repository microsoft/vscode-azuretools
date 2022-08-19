/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ApplicationInsightsManagementClient } from "@azure/arm-appinsights";
import type { ApplicationInsightsComponent } from "@azure/arm-appinsights";
import { LocationListStep, uiUtils } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardPromptStep, IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions, nonNullProp } from "@microsoft/vscode-azext-utils";
import { localize } from "../localize";
import { createAppInsightsClient } from "../utils/azureClients";
import { AppInsightsCreateStep } from "./AppInsightsCreateStep";
import { AppInsightsNameStep } from "./AppInsightsNameStep";
import { IAppServiceWizardContext } from "./IAppServiceWizardContext";
import { LogAnalyticsCreateStep } from "./LogAnalyticsCreateStep";

export const appInsightsNamingRules: IAzureNamingRules = {
    minLength: 1,
    maxLength: 255,
    invalidCharsRegExp: /[^a-zA-Z0-9\.\_\-\(\)]/
};

const skipForNowLabel: string = '$(clock) Skip for now';

export class AppInsightsListStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    private _suppressCreate: boolean | undefined;

    public constructor(suppressCreate?: boolean) {
        super();
        this._suppressCreate = suppressCreate;
    }

    public static async getAppInsightsComponents(context: IAppServiceWizardContext): Promise<ApplicationInsightsComponent[]> {
        if (context.appInsightsTask === undefined) {
            const client: ApplicationInsightsManagementClient = await createAppInsightsClient(context);
            context.appInsightsTask = uiUtils.listAllIterator(client.components.list());
        }

        return await context.appInsightsTask;
    }

    public async prompt(context: IAppServiceWizardContext): Promise<void> {
        const options: IAzureQuickPickOptions = { placeHolder: 'Select an Application Insights resource for your app.', id: `AppInsightsListStep/${context.subscriptionId}` };
        const input: IAzureQuickPickItem<ApplicationInsightsComponent | undefined> = (await context.ui.showQuickPick(this.getQuickPicks(context), options));
        context.appInsightsComponent = input.data;

        // as create new and skipForNow both have undefined as the data type, check the label
        if (input.label === skipForNowLabel) {
            context.telemetry.properties.aiSkipForNow = 'true';
            context.appInsightsSkip = true;
        } else {
            context.telemetry.properties.newAI = String(!context.appInsightsComponent);
        }
    }

    public shouldPrompt(context: IAppServiceWizardContext): boolean {
        return !context.appInsightsComponent;
    }

    public async getSubWizard(context: IAppServiceWizardContext): Promise<IWizardOptions<IAppServiceWizardContext> | undefined> {
        if (context.appInsightsComponent) {
            context.valuesToMask.push(nonNullProp(context.appInsightsComponent, 'name'));
        } else if (!context.appInsightsSkip) {
            const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [new AppInsightsNameStep()];
            LocationListStep.addStep(context, promptSteps);
            return {
                promptSteps: promptSteps,
                executeSteps: [new LogAnalyticsCreateStep(), new AppInsightsCreateStep()]
            };
        }

        return undefined;
    }

    private async getQuickPicks(context: IAppServiceWizardContext): Promise<IAzureQuickPickItem<ApplicationInsightsComponent | undefined>[]> {

        const picks: IAzureQuickPickItem<ApplicationInsightsComponent | undefined>[] = !this._suppressCreate ? [{
            label: localize('newApplicationInsight', '$(plus) Create new Application Insights resource'),
            data: undefined
        }] : [];

        picks.push({
            label: localize('skipForNow', skipForNowLabel),
            data: undefined
        });

        let components: ApplicationInsightsComponent[] = await AppInsightsListStep.getAppInsightsComponents(context);

        // https://github.com/microsoft/vscode-azurefunctions/issues/1454
        if (!Array.isArray(components)) {
            components = [];
        }

        return picks.concat(components.map((ai: ApplicationInsightsComponent) => {
            return {
                id: ai.id,
                label: nonNullProp(ai, 'name'),
                description: ai.location,
                data: ai
            };
        }));
    }
}
