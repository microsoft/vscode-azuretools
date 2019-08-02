/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsManagementClient } from "azure-arm-appinsights";
import { ApplicationInsightsComponent, ApplicationInsightsComponentListResult } from "azure-arm-appinsights/lib/models";
import { IAppServiceWizardContext } from "vscode-azureappservice";
import { AzureWizardPromptStep, createAzureClient, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions, LocationListStep } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { localize } from "../../localize";
import { ICreateFuntionAppContext } from "../../tree/SubscriptionTreeItem";
import { AppInsightsCreateStep } from "./AppInsightsCreateStep";
import { AppInsightsNameStep } from "./AppInsightsNameStep";

export class AppInsightsListStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public static async getAppInsightsComponents(wizardContext: IAppServiceWizardContext & Partial<ICreateFuntionAppContext>): Promise<ApplicationInsightsComponentListResult> {
        const client: ApplicationInsightsManagementClient = createAzureClient(wizardContext, ApplicationInsightsManagementClient);
        return await client.components.listByResourceGroup('naturinsapi');
    }

    public static async isNameAvailable(wizardContext: IAppServiceWizardContext, name: string): Promise<boolean> {
        const resourceGroupsTask: Promise<ApplicationInsightsComponentListResult> = AppInsightsListStep.getAppInsightsComponents(wizardContext);
        return !(await resourceGroupsTask).some((rg: ApplicationInsightsComponent) => rg.name !== undefined && rg.name.toLowerCase() === name.toLowerCase());
    }

    public async prompt(wizardContext: IAppServiceWizardContext & Partial<ICreateFuntionAppContext>): Promise<void> {
        // Cache resource group separately per subscription
        const options: IAzureQuickPickOptions = { placeHolder: 'Select an Application Insight for new resources.', id: `AppInsightsListStep/${wizardContext.subscriptionId}` };
        wizardContext.applicationInsights = (await ext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
    }

    public async getSubWizard(wizardContext: IAppServiceWizardContext & Partial<ICreateFuntionAppContext>): Promise<IWizardOptions<IAppServiceWizardContext> | undefined> {
        if (!wizardContext.applicationInsights) {
            const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [new AppInsightsNameStep()];
            if (!wizardContext.resourceGroupDeferLocationStep) {
                promptSteps.push(new LocationListStep());
            }

            return {
                promptSteps,
                executeSteps: [new AppInsightsCreateStep()]
            };
        } else {
            return undefined;
        }
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext & Partial<ICreateFuntionAppContext>): boolean {
        return !wizardContext.applicationInsights && !wizardContext.newResourceGroupName;
    }

    private async getQuickPicks(wizardContext: IAppServiceWizardContext): Promise<IAzureQuickPickItem<ApplicationInsightsComponent | undefined>[]> {
        const picks: IAzureQuickPickItem<ApplicationInsightsComponent | undefined>[] = [{
            label: localize('NewApplicationInsight', '$(plus) Create new application insight'),
            description: '',
            data: undefined
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
