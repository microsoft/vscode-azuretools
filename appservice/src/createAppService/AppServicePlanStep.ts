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
import { QuickPickOptions } from 'vscode';
import { localize } from '../localize';
import { uiUtils } from '../utils/uiUtils';
import { IQuickPickItemWithData } from '../wizard/IQuickPickItemWithData';
import { WizardStep } from '../wizard/WizardStep';
import { AppKind, getAppServicePlanModelKind, WebsiteOS } from './AppKind';
import { AppServiceCreator } from './AppServiceCreator';

export class AppServicePlanStep extends WizardStep {
    protected readonly wizard: AppServiceCreator;

    private _createNew: boolean;
    private _plan: AppServicePlan;
    private readonly _appKind: AppKind;
    private readonly _websiteOS: WebsiteOS;
    private readonly _createNewItem: IQuickPickItemWithData<AppServicePlan> = {
        persistenceId: '$new',
        label: localize('CreateNewAppServicePlan', '$(plus) Create New App Service Plan'),
        description: '',
        data: this._plan
    };

    constructor(wizard: AppServiceCreator, appKind: AppKind, websiteOS: WebsiteOS) {
        super(wizard);
        this._appKind = appKind;
        this._websiteOS = websiteOS;
    }

    public async prompt(): Promise<void> {
        const credentials: ServiceClientCredentials = this.wizard.subscriptionStep.credentials;
        const subscription: Subscription = this.wizard.subscriptionStep.subscription;
        const client: WebSiteManagementClient = new WebSiteManagementClient(credentials, subscription.subscriptionId);
        // You can create a web app and associate it with a plan from another resource group.
        // That's why we use list instead of listByResourceGroup below; and show resource group name in the quick pick list.

        const plansTask: Promise<AppServicePlan[]> = uiUtils.listAll(client.appServicePlans, client.appServicePlans.list());

        const rg: ResourceGroup = this.wizard.resourceGroupStep.resourceGroup;
        let newPlanName: string;

        // Cache hosting plan separately per subscription
        const quickPickOptions: QuickPickOptions = { placeHolder: `Select an App Service Plan. (${this.stepProgressText}) ` };
        const appServicePlan: AppServicePlan = await this.showQuickPick(this.getQuickPicks(plansTask), quickPickOptions, `NewWebApp.AppHostingPlan/${subscription.id}`);

        if (appServicePlan !== this._createNewItem.data) {
            this._createNew = false;
            this._plan = appServicePlan;
            return;
        }

        // Prompt for new plan information.
        const suggestedName: string = await this.wizard.websiteNameStep.computeRelatedName();
        const plans: AppServicePlan[] = await plansTask;
        newPlanName = await this.showInputBox({
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

        const pricingTiers: IQuickPickItemWithData<SkuDescription>[] = this.getPlanSkus().map((s: SkuDescription) => {
            return {
                persistenceId: s.name,
                label: s.name,
                description: s.tier,
                detail: '',
                data: s
            };
        });
        const sku: SkuDescription = await this.showQuickPick(pricingTiers, { placeHolder: localize('PricingTierPlaceholder', 'Choose your pricing tier.') }, 'NewWebApp.PricingTier');
        this._createNew = true;

        this._plan = {
            appServicePlanName: newPlanName.trim(),
            kind: getAppServicePlanModelKind(this._appKind, this._websiteOS),
            sku: sku,
            location: rg.location,
            reserved: this._websiteOS === WebsiteOS.linux  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
        };
    }

    public async execute(): Promise<void> {
        if (!this._createNew) {
            this.wizard.writeline(localize('UsingAppServicePlan', 'Using App Service plan "{0} ({1})".', this._plan.appServicePlanName, this._plan.sku.name));
            return;
        }

        this.wizard.writeline(localize('CreatingAppServicePlan', 'Creating new App Service plan "{0} ({1})"...', this._plan.appServicePlanName, this._plan.sku.name));
        const credentials: ServiceClientCredentials = this.wizard.subscriptionStep.credentials;
        const subscription: Subscription = this.wizard.subscriptionStep.subscription;
        const rg: ResourceGroup = this.wizard.resourceGroupStep.resourceGroup;
        const websiteClient: WebSiteManagementClient = new WebSiteManagementClient(credentials, subscription.subscriptionId);
        this._plan = await websiteClient.appServicePlans.createOrUpdate(rg.name, this._plan.appServicePlanName, this._plan);
        this.wizard.writeline(localize('CreatedAppServicePlan', 'Created App Service plan "{0} ({1})".', this._plan.appServicePlanName, this._plan.sku.name));
    }

    public get servicePlan(): AppServicePlan {
        return this._plan;
    }

    public get createNew(): boolean {
        return this._createNew;
    }

    private async getQuickPicks(plansTask: Promise<AppServicePlan[]>): Promise<IQuickPickItemWithData<AppServicePlan>[]> {
        const plans: AppServicePlan[] = await plansTask;
        const quickPickItems: IQuickPickItemWithData<AppServicePlan>[] = [this._createNewItem];
        plans.forEach((plan: AppServicePlan) => {
            // Plan kinds can look like "app,linux", etc. for Linux
            const isLinux: boolean = plan.kind.toLowerCase().split(',').find((value: string) => value === WebsiteOS.linux) !== null;
            const isCompatible: boolean = (this._websiteOS === WebsiteOS.linux) === isLinux;

            if (isCompatible) {
                quickPickItems.push({
                    persistenceId: plan.id,
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
