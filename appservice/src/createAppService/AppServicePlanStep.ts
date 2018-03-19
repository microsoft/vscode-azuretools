/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { AppServicePlan, SkuDescription } from 'azure-arm-website/lib/models';
import { OutputChannel } from 'vscode';
import { AzureWizardStep, IAzureNamingRules, IAzureQuickPickOptions, IAzureUserInput } from 'vscode-azureextensionui';
import { IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { uiUtils } from '../utils/uiUtils';
import { getAppServicePlanModelKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export const appServicePlanNamingRules: IAzureNamingRules = {
    minLength: 1,
    maxLength: 40,
    invalidCharsRegExp: /[^a-zA-Z0-9\-]/
};

export class AppServicePlanStep extends AzureWizardStep<IAppServiceWizardContext> {
    private _newSku: SkuDescription;
    private _newName: string;

    public static async getPlans(wizardContext: IAppServiceWizardContext): Promise<AppServicePlan[]> {
        if (wizardContext.plansTask === undefined) {
            // tslint:disable-next-line:no-non-null-assertion
            const client: WebSiteManagementClient = new WebSiteManagementClient(wizardContext.credentials, wizardContext.subscription.subscriptionId!);
            wizardContext.plansTask = uiUtils.listAll(client.appServicePlans, client.appServicePlans.list());
        }

        return await wizardContext.plansTask;
    }

    public static async isNameAvailable(wizardContext: IAppServiceWizardContext, name: string, resourceGroupName: string): Promise<boolean> {
        const plans: AppServicePlan[] = await AppServicePlanStep.getPlans(wizardContext);
        return !plans.some((plan: AppServicePlan) =>
            plan.resourceGroup.toLowerCase() === resourceGroupName.toLowerCase() &&
            plan.name.toLowerCase() === name.toLowerCase()
        );
    }

    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {
        // Cache hosting plan separately per subscription
        const options: IAzureQuickPickOptions = { placeHolder: 'Select an App Service plan.', id: `AppServicePlanStep/${wizardContext.subscription.subscriptionId}` };
        wizardContext.plan = (await ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;

        if (wizardContext.plan) {
            wizardContext.defaultLocationName = wizardContext.plan.location;
        } else {
            this._newName = (await ui.showInputBox({
                value: await wizardContext.relatedNameTask,
                prompt: localize('AppServicePlanPrompt', 'Enter the name of the new App Service plan.'),
                validateInput: async (value: string): Promise<string | undefined> => await this.validatePlanName(wizardContext, value)
            })).trim();

            const pricingTiers: IAzureQuickPickItem<SkuDescription>[] = this.getPlanSkus().map((s: SkuDescription) => {
                return {
                    label: s.name,
                    description: s.tier,
                    data: s
                };
            });
            this._newSku = (await ui.showQuickPick(pricingTiers, { placeHolder: localize('PricingTierPlaceholder', 'Select a pricing tier for the new App Service plan.') })).data;
        }

        return wizardContext;
    }

    public async execute(wizardContext: IAppServiceWizardContext, outputChannel: OutputChannel): Promise<IAppServiceWizardContext> {
        if (wizardContext.plan) {
            outputChannel.appendLine(localize('UsingAppServicePlan', 'Using App Service plan "{0}" with pricing tier "{1}".', wizardContext.plan.appServicePlanName, wizardContext.plan.sku.name));
        } else {
            outputChannel.appendLine(localize('CreatingAppServicePlan', 'Creating App Service plan "{0}" with pricing tier "{1}"...', this._newName, this._newSku.name));
            const websiteClient: WebSiteManagementClient = new WebSiteManagementClient(wizardContext.credentials, wizardContext.subscription.subscriptionId);
            wizardContext.plan = await websiteClient.appServicePlans.createOrUpdate(wizardContext.resourceGroup.name, this._newName, {
                appServicePlanName: this._newName,
                kind: getAppServicePlanModelKind(wizardContext.appKind, wizardContext.websiteOS),
                sku: this._newSku,
                location: wizardContext.location.name,
                reserved: wizardContext.websiteOS === WebsiteOS.linux  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
            });
            outputChannel.appendLine(localize('CreatedAppServicePlan', 'Successfully created App Service plan "{0}".', this._newName));
        }

        return wizardContext;
    }

    private async validatePlanName(wizardContext: IAppServiceWizardContext, name: string | undefined): Promise<string | undefined> {
        name = name ? name.trim() : '';

        if (name.length < appServicePlanNamingRules.minLength || name.length > appServicePlanNamingRules.maxLength) {
            return localize('invalidLength', 'The name must be between {0} and {1} characters.', appServicePlanNamingRules.minLength, appServicePlanNamingRules.maxLength);
        } else if (name.match(appServicePlanNamingRules.invalidCharsRegExp)) {
            return localize('invalidChars', "The name can only contain alphanumeric characters and hyphens.");
        } else if (wizardContext.resourceGroup && !await AppServicePlanStep.isNameAvailable(wizardContext, name, wizardContext.resourceGroup.name)) {
            return localize('nameAlreadyExists', 'App Service plan "{0}" already exists in resource group "{1}".', name, wizardContext.resourceGroup.name);
        } else {
            return undefined;
        }
    }

    private async getQuickPicks(wizardContext: IAppServiceWizardContext): Promise<IAzureQuickPickItem<AppServicePlan | undefined>[]> {
        const picks: IAzureQuickPickItem<AppServicePlan | undefined>[] = [{
            label: localize('CreateNewAppServicePlan', '$(plus) Create new App Service plan'),
            description: '',
            data: undefined
        }];

        const plans: AppServicePlan[] = await AppServicePlanStep.getPlans(wizardContext);
        for (const plan of plans) {
            if (plan.kind.toLowerCase().includes(wizardContext.websiteOS)) {
                picks.push({
                    id: plan.id,
                    label: plan.appServicePlanName,
                    description: `${plan.sku.name} (${plan.geoRegion})`,
                    detail: plan.resourceGroup,
                    data: plan
                });
            }
        }

        return picks;
    }

    private getPlanSkus(): SkuDescription[] {
        return [
            {
                name: 'S1',
                tier: 'Standard',
                size: 'S1',
                family: 'S',
                capacity: 1
            },
            {
                name: 'S2',
                tier: 'Standard',
                size: 'S2',
                family: 'S',
                capacity: 1
            },
            {
                name: 'S3',
                tier: 'Standard',
                size: 'S3',
                family: 'S',
                capacity: 1
            },
            {
                name: 'B1',
                tier: 'Basic',
                size: 'B1',
                family: 'B',
                capacity: 1
            },
            {
                name: 'B2',
                tier: 'Basic',
                size: 'B2',
                family: 'B',
                capacity: 1
            },
            {
                name: 'B3',
                tier: 'Basic',
                size: 'B3',
                family: 'B',
                capacity: 1
            }
        ];
    }
}
