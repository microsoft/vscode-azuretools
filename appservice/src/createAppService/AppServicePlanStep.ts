/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import { Subscription } from 'azure-arm-resource/lib/subscription/models';
// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { AppServicePlan, SkuDescription } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { OutputChannel } from 'vscode';
import { AzureWizardStep, IAzureQuickPickOptions, IAzureUserInput } from 'vscode-azureextensionui';
import { IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { uiUtils } from '../utils/uiUtils';
import { getAppServicePlanModelKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanStep extends AzureWizardStep<IAppServiceWizardContext> {
    private _createNew: boolean;

    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {
        const credentials: ServiceClientCredentials = wizardContext.credentials;
        const subscription: Subscription = wizardContext.subscription;
        const client: WebSiteManagementClient = new WebSiteManagementClient(credentials, subscription.subscriptionId);
        // You can create a web app and associate it with a plan from another resource group.
        // That's why we use list instead of listByResourceGroup below; and show resource group name in the quick pick list.

        const plansTask: Promise<AppServicePlan[]> = uiUtils.listAll(client.appServicePlans, client.appServicePlans.list());

        const rg: ResourceGroup = wizardContext.resourceGroup;
        let newPlanName: string;

        // Cache hosting plan separately per subscription
        const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select an App Service Plan.', id: `NewWebApp.AppHostingPlan/${subscription.id}` };
        const appServicePlan: AppServicePlan = (await ui.showQuickPick(this.getQuickPicks(wizardContext, plansTask), quickPickOptions)).data;

        if (appServicePlan !== undefined) {
            this._createNew = false;
            wizardContext.plan = appServicePlan;
            return wizardContext;
        }

        // Prompt for new plan information.
        const suggestedName: string = await wizardContext.relatedNameTask;
        const plans: AppServicePlan[] = await plansTask;
        newPlanName = await ui.showInputBox({
            value: suggestedName,
            prompt: localize('AppServicePlanPrompt', 'Enter the name of the new App Service Plan.'),
            validateInput: (value: string): string | undefined => {
                value = value ? value.trim() : '';

                if (plans.findIndex((plan: AppServicePlan) => plan.resourceGroup.toLowerCase() === rg.name && value.localeCompare(plan.name) === 0) >= 0) {
                    return localize('AppServicePlanAlreadyExists', 'App Service name "{0}" already exists in resource group "{1}".', value, rg.name);
                }

                if (!value.match(/^[a-z0-9\-]{1,40}$/ig)) {
                    return localize('AppServicePlanRegExpError', 'App Service name should be 1-40 characters long and can only include alphanumeric characters and hyphens.');
                }

                return undefined;
            }
        });

        const pricingTiers: IAzureQuickPickItem<SkuDescription>[] = this.getPlanSkus().map((s: SkuDescription) => {
            return {
                label: s.name,
                description: s.tier,
                detail: '',
                data: s
            };
        });
        const sku: SkuDescription = (await ui.showQuickPick(pricingTiers, { placeHolder: localize('PricingTierPlaceholder', 'Choose your pricing tier.') })).data;
        this._createNew = true;

        wizardContext.plan = {
            appServicePlanName: newPlanName.trim(),
            kind: getAppServicePlanModelKind(wizardContext.appKind, wizardContext.websiteOS),
            sku: sku,
            location: rg.location,
            reserved: wizardContext.websiteOS === WebsiteOS.linux  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
        };

        return wizardContext;
    }

    public async execute(wizardContext: IAppServiceWizardContext, outputChannel: OutputChannel): Promise<IAppServiceWizardContext> {
        if (!this._createNew) {
            outputChannel.appendLine(localize('UsingAppServicePlan', 'Using App Service plan "{0} ({1})".', wizardContext.plan.appServicePlanName, wizardContext.plan.sku.name));
            return wizardContext;
        }

        outputChannel.appendLine(localize('CreatingAppServicePlan', 'Creating new App Service plan "{0} ({1})"...', wizardContext.plan.appServicePlanName, wizardContext.plan.sku.name));
        const credentials: ServiceClientCredentials = wizardContext.credentials;
        const subscription: Subscription = wizardContext.subscription;
        const rg: ResourceGroup = wizardContext.resourceGroup;
        const websiteClient: WebSiteManagementClient = new WebSiteManagementClient(credentials, subscription.subscriptionId);
        wizardContext.plan = await websiteClient.appServicePlans.createOrUpdate(rg.name, wizardContext.plan.appServicePlanName, wizardContext.plan);
        outputChannel.appendLine(localize('CreatedAppServicePlan', 'Created App Service plan "{0} ({1})".', wizardContext.plan.appServicePlanName, wizardContext.plan.sku.name));
        return wizardContext;
    }

    private async getQuickPicks(wizardContext: IAppServiceWizardContext, plansTask: Promise<AppServicePlan[]>): Promise<IAzureQuickPickItem<AppServicePlan>[]> {
        const plans: AppServicePlan[] = await plansTask;
        const quickPickItems: IAzureQuickPickItem<AppServicePlan>[] = [{
            id: '$new',
            label: localize('CreateNewAppServicePlan', '$(plus) Create New App Service Plan'),
            description: '',
            data: wizardContext.plan
        }];
        plans.forEach((plan: AppServicePlan) => {
            // Plan kinds can look like "app,linux", etc. for Linux
            const isLinux: boolean = plan.kind.toLowerCase().split(',').find((value: string) => value === WebsiteOS.linux) !== null;
            const isCompatible: boolean = (wizardContext.websiteOS === WebsiteOS.linux) === isLinux;

            if (isCompatible) {
                quickPickItems.push({
                    id: plan.id,
                    label: plan.appServicePlanName,
                    description: `${plan.sku.name} (${plan.geoRegion})`,
                    detail: plan.resourceGroup,
                    data: plan
                });
            }
        });

        return quickPickItems;
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
