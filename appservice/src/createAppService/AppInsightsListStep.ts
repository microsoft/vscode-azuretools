/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsManagementClient } from "azure-arm-appinsights";
import { ApplicationInsightsComponent, ApplicationInsightsComponentListResult } from "azure-arm-appinsights/lib/models";
import { AzureWizardPromptStep, createAzureClient, IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { AppInsightsCreateStep } from "./AppInsightsCreateStep";
import { AppInsightsLocationStep } from "./AppInsightsLocationStep";
import { IAppServiceWizardContext } from "./IAppServiceWizardContext";

export const appInsightsNamingRules: IAzureNamingRules = {
    minLength: 1,
    maxLength: 255,
    invalidCharsRegExp: /[^a-zA-Z0-9\.\_\-\(\)]/
};

const skipForNow: string = '$(circle-slash) Skip for now';

export class AppInsightsListStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public static async getAppInsightsComponents(wizardContext: IAppServiceWizardContext): Promise<ApplicationInsightsComponentListResult> {
        const client: ApplicationInsightsManagementClient = createAzureClient(wizardContext, ApplicationInsightsManagementClient);
        return await client.components.list();
    }

    public static async isNameAvailable(wizardContext: IAppServiceWizardContext, name: string): Promise<boolean> {
        const resourceGroupsTask: Promise<ApplicationInsightsComponentListResult> = AppInsightsListStep.getAppInsightsComponents(wizardContext);
        return !(await resourceGroupsTask).some((rg: ApplicationInsightsComponent) => rg.name !== undefined && rg.name.toLowerCase() === name.toLowerCase());
    }

    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        const options: IAzureQuickPickOptions = { placeHolder: 'Select an Application Insight for new resources.', id: `AppInsightsListStep/${wizardContext.subscriptionId}` };
        wizardContext.appInsightsComponent = (await ext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.appInsightsComponent && !!wizardContext.location;
    }

    public async getSubWizard(wizardContext: IAppServiceWizardContext): Promise<IWizardOptions<IAppServiceWizardContext> | undefined> {
        if (!wizardContext.appInsightsComponent && wizardContext.appInsightsComponent !== skipForNow) {
            return {
                promptSteps: [new AppInsightsLocationStep()],
                executeSteps: [new AppInsightsCreateStep()]
            };
        } else {
            return undefined;
        }
    }

    private async getQuickPicks(wizardContext: IAppServiceWizardContext): Promise<IAzureQuickPickItem<ApplicationInsightsComponent | string | undefined>[]> {

        const picks: IAzureQuickPickItem<ApplicationInsightsComponent | string | undefined>[] = [{
            label: localize('newApplicationInsight', '$(plus) Create new application insight'),
            description: '',
            data: undefined
        },
        {
            label: localize('skipForNow', skipForNow),
            description: '',
            data: skipForNow
        }];

        const applicationInsights: ApplicationInsightsComponentListResult = await AppInsightsListStep.getAppInsightsComponents(wizardContext);
        return picks.concat(applicationInsights.map((ai: ApplicationInsightsComponent) => {
            return {
                id: ai.id,
                // tslint:disable-next-line:no-non-null-assertion
                label: ai.name!,
                description: ai.location,
                data: ai
            };
        }));
    }
}
