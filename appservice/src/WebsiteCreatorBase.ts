/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { WizardBase, WizardResult, WizardStep, SubscriptionStepBase, QuickPickItemWithData } from './wizard';
import { SubscriptionModels, ResourceManagementClient, ResourceModels } from 'azure-arm-resource';
import WebSiteManagementClient = require('azure-arm-website');
import * as WebSiteModels from '../node_modules/azure-arm-website/lib/models';
import * as util from './util';

export type WebsiteOS = "linux" | "windows";
export type AppKind = "app" | "functionapp";

export abstract class WebsiteCreatorBase extends WizardBase {
    constructor(output: vscode.OutputChannel, protected readonly azureAccount: AzureAccountWrapper, protected readonly subscription: SubscriptionModels.Subscription, protected readonly persistence?: vscode.Memento) {
        super(output);
    }

    protected abstract appKind: AppKind;
    protected abstract websiteOS: WebsiteOS;

    protected abstract initSteps(): void;

    async run(promptOnly = false): Promise<WizardResult> {
        // If not signed in, execute the sign in command and wait for it...
        if (this.azureAccount.signInStatus !== 'LoggedIn') {
            await vscode.commands.executeCommand(util.getSignInCommandString());
        }
        // Now check again, if still not signed in, cancel.
        if (this.azureAccount.signInStatus !== 'LoggedIn') {
            return {
                status: 'Cancelled',
                step: this.steps[0],
                error: null
            };
        }

        return super.run(promptOnly);
    }

    get createdWebSite(): WebSiteModels.Site {
        return this.findStepOfType(WebsiteStep).website;
    }

    protected beforeExecute(_step: WizardStep, stepIndex: number) {
        if (stepIndex == 0) {
            this.writeline('Start creating new Web App...');
        }
    }
}

export class WebsiteCreatorStepBase extends WizardStep {
    protected constructor(wizard: WizardBase, telemetryStepTitle: string, readonly azureAccount: AzureAccountWrapper, persistence: vscode.Memento) {
        super(wizard, telemetryStepTitle, persistence);
    }

    protected computeRelatedName(): Promise<string> {
        var promise = this.wizard.findStepOfType(WebsiteNameStep).computeRelatedName();
        if (!promise) {
            throw new Error('A website name must be entered first.');
        }

        return promise;
    }

    protected getSelectedSubscription(): SubscriptionModels.Subscription {
        const subscriptionStep = this.wizard.findStepOfType(SubscriptionStep);

        if (!subscriptionStep.subscription) {
            throw new Error('A subscription must be selected first.');
        }

        return subscriptionStep.subscription;
    }

    protected getSelectedResourceGroup(): ResourceModels.ResourceGroup {
        const resourceGroupStep = this.wizard.findStepOfType(ResourceGroupStep);

        if (!resourceGroupStep.resourceGroup) {
            throw new Error('A resource group must be selected first.');
        }

        return resourceGroupStep.resourceGroup;
    }

    protected getSelectedAppServicePlanOptional(): WebSiteModels.AppServicePlan | undefined {
        const appServicePlanStep = this.wizard.findStepOfType(AppServicePlanStep, true/*isOptional*/);

        if (appServicePlanStep && !appServicePlanStep.servicePlan) {
            throw new Error('An App Service Plan must be selected first.');
        }

        return appServicePlanStep && appServicePlanStep.servicePlan;
    }

    protected getWebsiteName(): string {
        const siteName = this.wizard.findStepOfType(WebsiteNameStep).websiteName;
        if (!siteName) {
            throw new Error('A website name must be entered first.');
        }

        return siteName;
    }
}

export class SubscriptionStep extends SubscriptionStepBase {
    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, private _resources: { prompt: string }, subscription?: SubscriptionModels.Subscription, persistence?: vscode.Memento) {
        super(wizard, 'SelectSubscription', azureAccount, subscription, persistence);
    }

    async prompt(): Promise<void> {
        if (!!this.subscription) {
            return;
        }

        const quickPickItems = this.getSubscriptionsAsQuickPickItems();
        const quickPickOptions = { placeHolder: `${this._resources.prompt} (${this.stepProgressText})` };
        const result = await this.showQuickPick(quickPickItems, quickPickOptions, "NewWebApp.Subscription");
        this._subscription = result.data;
    }

    async execute(): Promise<void> {
        this.wizard.writeline(`The app will be created in subscription "${this.subscription.displayName}" (${this.subscription.subscriptionId}).`);
    }
}

export class ResourceGroupStep extends WebsiteCreatorStepBase {
    private _createNew: boolean;
    private _rg: ResourceModels.ResourceGroup;

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, persistence?: vscode.Memento) {
        super(wizard, 'SelectOrCreateResourceGroup', azureAccount, persistence);
    }

    async prompt(): Promise<void> {
        const createNewItem: QuickPickItemWithData<ResourceModels.ResourceGroup> = {
            persistenceId: "",
            label: '$(plus) Create New Resource Group',
            description: null,
            data: null
        };
        const quickPickOptions = { placeHolder: `Select a resource group. (${this.stepProgressText})` };
        const subscription = this.getSelectedSubscription();
        const resourceClient = new ResourceManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        var resourceGroups: ResourceModels.ResourceGroup[];
        const resourceGroupsTask = util.listAll(resourceClient.resourceGroups, resourceClient.resourceGroups.list());
        var locationsTask = this.azureAccount.getLocationsBySubscription(this.getSelectedSubscription());
        var locations: SubscriptionModels.Location[];
        var newRgName: string;

        const quickPickItemsTask = Promise.all([resourceGroupsTask, locationsTask]).then(results => {
            const quickPickItems: QuickPickItemWithData<ResourceModels.ResourceGroup>[] = [createNewItem];
            resourceGroups = results[0];
            locations = results[1];
            resourceGroups.forEach(rg => {
                quickPickItems.push({
                    persistenceId: rg.id,
                    label: rg.name,
                    description: `(${locations.find(l => l.name.toLowerCase() === rg.location.toLowerCase()).displayName})`,
                    detail: '',
                    data: rg
                });
            });

            return quickPickItems;
        });

        // Cache resource group separately per subscription
        const result = await this.showQuickPick(quickPickItemsTask, quickPickOptions, `"NewWebApp.ResourceGroup/${subscription.id}`);

        if (result.data) {
            this._createNew = false;
            this._rg = result.data;
            return;
        }

        this._createNew = true;
        var suggestedName = await this.computeRelatedName();
        newRgName = await this.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new resource group.',
            validateInput: (value: string) => {
                value = value ? value.trim() : '';

                if (resourceGroups.findIndex(rg => rg.name.localeCompare(value) === 0) >= 0) {
                    return `Resource group name "${value}" already exists.`;
                }

                if (!value.match(/^[a-z0-9.\-_()]{0,89}[a-z0-9\-_()]$/ig)) {
                    return 'Resource group name should be 1-90 characters long and can only include alphanumeric characters, periods, ' +
                        'underscores, hyphens and parenthesis and cannot end in a period.';
                }

                return null;
            }
        });

        const locationPickItems = locations.map<QuickPickItemWithData<SubscriptionModels.Location>>(location => {
            return {
                label: location.displayName,
                description: `(${location.name})`,
                detail: '',
                persistenceId: location.name,
                data: location
            };
        });
        const locationPickOptions = { placeHolder: 'Select the location for the new resource group.' };
        const pickedLocation = await this.showQuickPick(locationPickItems, locationPickOptions, "NewWebApp.Location");

        this._rg = {
            name: newRgName.trim(),
            location: pickedLocation.data.name
        }
    }

    async execute(): Promise<void> {
        if (!this._createNew) {
            this.wizard.writeline(`Existing resource group "${this._rg.name} (${this._rg.location})" will be used.`);
            return;
        }

        this.wizard.writeline(`Creating new resource group "${this._rg.name} (${this._rg.location})"...`);
        const subscription = this.getSelectedSubscription();
        const resourceClient = new ResourceManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        this._rg = await resourceClient.resourceGroups.createOrUpdate(this._rg.name, this._rg);
        this.wizard.writeline(`Resource group created.`);
    }

    get resourceGroup(): ResourceModels.ResourceGroup {
        return this._rg;
    }

    get createNew(): boolean {
        return this._createNew;
    }
}

export class AppServicePlanStep extends WebsiteCreatorStepBase {
    private _createNew: boolean;
    private _plan: WebSiteModels.AppServicePlan;

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, private _appKind: AppKind, private _websiteOS: WebsiteOS, persistence: vscode.Memento) {
        super(wizard, 'SelectOrCreateAppServicePlan', azureAccount, persistence);
    }

    async prompt(): Promise<void> {
        const createNewItem: QuickPickItemWithData<WebSiteModels.AppServicePlan> = {
            persistenceId: "$new",
            label: '$(plus) Create New App Service Plan',
            description: '',
            data: this._plan
        };
        const quickPickOptions = { placeHolder: `Select an App Service. (${this.stepProgressText}) ` };
        const subscription = this.getSelectedSubscription();
        const client = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        // You can create a web app and associate it with a plan from another resource group.
        // That's why we use list instead of listByResourceGroup below; and show resource group name in the quick pick list.

        let plans: WebSiteModels.AppServicePlan[];
        const plansTask = util.listAll(client.appServicePlans, client.appServicePlans.list()).then(result => {
            const quickPickItems = [createNewItem];
            plans = result;
            plans.forEach(plan => {
                // Plan kinds can look like "app,linux", etc. for Linux
                var isLinux = plan.kind.toLowerCase().split(",").find(value => value === 'linux') !== null;
                var isCompatible = (this._websiteOS === "linux") === isLinux;

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
        });

        const rg = this.getSelectedResourceGroup();
        var newPlanName: string;

        // Cache hosting plan separately per subscription
        const pickedItem = await this.showQuickPick(plansTask, quickPickOptions, `NewWebApp.AppHostingPlan/${subscription.id}`);

        if (pickedItem !== createNewItem) {
            this._createNew = false;
            this._plan = pickedItem.data;
            return;
        }

        // Prompt for new plan information.
        const suggestedName = await this.computeRelatedName();
        newPlanName = await this.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new App Service Plan.',
            validateInput: (value: string) => {
                value = value ? value.trim() : '';

                if (plans.findIndex(plan => plan.resourceGroup.toLowerCase() === rg.name && value.localeCompare(plan.name) === 0) >= 0) {
                    return `App Service name "${value}" already exists in resource group "${rg.name}".`;
                }

                if (!value.match(/^[a-z0-9\-]{1,40}$/ig)) {
                    return 'App Service name should be 1-40 characters long and can only include alphanumeric characters and hyphens.';
                }

                return null;
            }
        });

        // Prompt for Pricing tier
        const pricingTiers: QuickPickItemWithData<WebSiteModels.SkuDescription>[] = [];
        const availableSkus = this.getPlanSkus();
        availableSkus.forEach(sku => {
            pricingTiers.push({
                persistenceId: sku.name,
                label: sku.name,
                description: sku.tier,
                detail: '',
                data: sku
            });
        });
        const pickedSkuItem = await this.showQuickPick(pricingTiers, { placeHolder: 'Choose your pricing tier.' }, "NewWebApp.PricingTier");
        const newPlanSku = pickedSkuItem.data;
        this._createNew = true;


        this._plan = {
            appServicePlanName: newPlanName.trim(),
            kind: GetAppServicePlanModelKind(this._appKind, this._websiteOS),
            sku: newPlanSku,
            location: rg.location,
            reserved: this._websiteOS === "linux"  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
        };
    }

    async execute(): Promise<void> {
        if (!this._createNew) {
            this.wizard.writeline(`Existing App Service Plan "${this._plan.appServicePlanName} (${this._plan.sku.name})" will be used.`);
            return;
        }

        this.wizard.writeline(`Creating new App Service Plan "${this._plan.appServicePlanName} (${this._plan.sku.name})"...`);
        const subscription = this.getSelectedSubscription();
        const rg = this.getSelectedResourceGroup();
        const websiteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        this._plan = await websiteClient.appServicePlans.createOrUpdate(rg.name, this._plan.appServicePlanName, this._plan);
        this.wizard.writeline(`App Service Plan created.`);
    }

    get servicePlan(): WebSiteModels.AppServicePlan {
        return this._plan;
    }

    get createNew(): boolean {
        return this._createNew;
    }

    private getPlanSkus(): WebSiteModels.SkuDescription[] {
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

export class WebsiteStep extends WebsiteCreatorStepBase {
    private _website: WebSiteModels.Site;

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, private _appKind: AppKind, private _websiteOS: WebsiteOS, persistence?: vscode.Memento) {
        super(wizard, "Create" + _appKind, azureAccount, persistence);
    }

    public async getSiteConfig(linuxFxVersion: string): Promise<WebSiteModels.SiteConfig> {
        return Promise.resolve({
            linuxFxVersion: linuxFxVersion
        });
    }

    async prompt(): Promise<void> {
        const siteName = this.getWebsiteName();

        var runtimeStack: string;
        const runtimeItems: QuickPickItemWithData<LinuxRuntimeStack>[] = [];
        const linuxRuntimeStacks = this.getLinuxRuntimeStack();

        linuxRuntimeStacks.forEach(rt => {
            runtimeItems.push({
                persistenceId: rt.name,
                label: rt.displayName,
                description: '',
                data: rt
            });
        });

        if (this._websiteOS === "linux") {
            const pickedItem = await this.showQuickPick(runtimeItems, { placeHolder: 'Select Linux runtime stack.' }, "NewWebApp.RuntimeStack");
            runtimeStack = pickedItem.data.name;
        } else {
            runtimeStack = undefined;
        }

        const rg = this.getSelectedResourceGroup();
        const optionalPlan = this.getSelectedAppServicePlanOptional();

        this._website = {
            name: siteName,
            kind: GetSiteModelKind(this._appKind, this._websiteOS),
            location: rg.location,
            serverFarmId: optionalPlan && optionalPlan.id,
            siteConfig: {
                linuxFxVersion: runtimeStack
                // The rest will be filled in during execute
            }
        };
    }

    async execute(): Promise<void> {
        this.wizard.writeline(`Creating new ${GetAppKindDisplayName(this._appKind)}: ${this._website.name}...`);
        const subscription = this.getSelectedSubscription();
        const rg = this.getSelectedResourceGroup();
        const websiteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);

        // If the plan is also newly created, its resource ID won't be available at this step's prompt stage, but should be available now.
        if (!this._website.serverFarmId) {
            this._website.serverFarmId = this.getSelectedAppServicePlanOptional() && this.getSelectedAppServicePlanOptional().id;
        }

        // Finish putting together the site configuration
        this._website.siteConfig = await this.getSiteConfig(this._website.siteConfig.linuxFxVersion);

        this._website = await websiteClient.webApps.createOrUpdate(rg.name, this._website.name, this._website);
        this._website.siteConfig = await websiteClient.webApps.getConfiguration(rg.name, this._website.name);

        this.wizard.writeline(`Created new ${GetAppKindDisplayName(this._appKind)} https://${this._website.defaultHostName}`);
        this.wizard.writeline('');
    }

    get website(): WebSiteModels.Site {
        return this._website;
    }

    private getLinuxRuntimeStack(): LinuxRuntimeStack[] {
        return [
            {
                name: 'node|4.4',
                displayName: 'Node.js 4.4'
            },
            {
                name: 'node|4.5',
                displayName: 'Node.js 4.5'
            },
            {
                name: 'node|6.2',
                displayName: 'Node.js 6.2'
            },
            {
                name: 'node|6.6',
                displayName: 'Node.js 6.6'
            },
            {
                name: 'node|6.9',
                displayName: 'Node.js 6.9'
            },
            {
                name: 'node|6.10',
                displayName: 'Node.js 6.10'
            },
            {
                name: 'node|6.11',
                displayName: 'Node.js 6.11 (LTS - Recommended for new apps)'
            },
            {
                name: 'node|8.0',
                displayName: 'Node.js 8.0'
            },
            {
                name: 'node|8.1',
                displayName: 'Node.js 8.1'
            }
        ];
    }
}

export class WebsiteNameStep extends WebsiteCreatorStepBase {
    private _websiteName: string;
    private _computeRelatedNamePromise: Promise<string>

    constructor(wizard: WizardBase, azureAccount: AzureAccountWrapper, private _appKind: AppKind, persistence?: vscode.Memento) {
        super(wizard, 'GetWebsiteName', azureAccount, persistence);
    }

    async prompt(): Promise<void> {
        const subscription = this.getSelectedSubscription();
        const client = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        let siteName: string;
        let siteNameOkay = false;

        while (!siteNameOkay) {
            siteName = await this.showInputBox({
                prompt: `Enter a globally unique name for the new ${GetAppKindDisplayName(this._appKind)}. (${this.stepProgressText})`,
                validateInput: (value: string) => {
                    value = value ? value.trim() : '';

                    if (!value.match(/^[a-z0-9\-]{1,60}$/ig)) {
                        return 'Name should be 1-60 characters long and can only include alphanumeric characters and hyphens.';
                    }

                    return null;
                }
            });
            siteName = siteName.trim();

            // Check if the name has already been taken...
            const nameAvailability = await client.checkNameAvailability(siteName, 'site');
            siteNameOkay = nameAvailability.nameAvailable;

            if (!siteNameOkay) {
                await vscode.window.showWarningMessage(nameAvailability.message);
            }
        }

        this._websiteName = siteName;
        this._computeRelatedNamePromise = this.generateRelatedName(siteName);
    }

    protected async isNameAvailable(name: string, resourceGroups: ResourceModels.ResourceGroup[], appServicePlans: WebSiteModels.AppServicePlan[]): Promise<boolean> {
        if (resourceGroups.findIndex(rg => rg.name.toLowerCase() === name.toLowerCase()) >= 0) {
            return false;
        }
        if (appServicePlans.findIndex(hp => hp.name.toLowerCase() === name.toLowerCase()) >= 0) {
            return false;
        }

        return true;
    }

    /**
     * Get a suggested base name for resources related to a given site name
     * @param siteName Site name
     */
    private async generateRelatedName(siteName: string): Promise<string> {
        const subscription = this.getSelectedSubscription();
        const resourceClient = new ResourceManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);
        const webSiteClient = new WebSiteManagementClient(this.azureAccount.getCredentialByTenantId(subscription.tenantId), subscription.subscriptionId);

        const resourceGroupsTask = util.listAll(resourceClient.resourceGroups, resourceClient.resourceGroups.list());
        const plansTask = util.listAll(webSiteClient.appServicePlans, webSiteClient.appServicePlans.list());

        var groups: ResourceModels.ResourceGroup[];
        let plans: WebSiteModels.AppServicePlan[];

        var results = await Promise.all([resourceGroupsTask, plansTask]);
        groups = results[0];
        plans = results[1];

        // Website names are limited to 60 characters, resource group names to 90, storage accounts to 24
        // Storage accounts cannot have uppercase letters or hyphens and at least 3 characters.
        // So restrict everything to: 3-24 charcters, lowercase and digits only.
        const minLength = 3;
        const maxLength = 24;

        var preferredName = siteName.toLowerCase().replace(/[^0-9a-z]/g, "");

        function generateSuffixedName(i: number): string {
            let suffix = `${i}`;
            let minUnsuffixedLength = minLength - suffix.length;
            let maxUnsuffixedLength = maxLength - suffix.length;
            let unsuffixedName = preferredName.slice(0, maxUnsuffixedLength) + "zzz".slice(0, Math.max(0, minUnsuffixedLength - preferredName.length));
            return unsuffixedName + suffix;
        }

        if (await this.isNameAvailable(preferredName, groups, plans)) {
            return preferredName;
        }

        var i = 2;
        while (true) {
            let newName = generateSuffixedName(i);
            let isAvailable = await this.isNameAvailable(newName, groups, plans);
            if (isAvailable) {
                return newName;
            }

            ++i;
        }
    }

    async execute(): Promise<void> {
    }

    get websiteName(): string {
        return this._websiteName;
    }

    public computeRelatedName(): Promise<string> {
        return this._computeRelatedNamePromise;
    }
}

interface LinuxRuntimeStack {
    name: string;
    displayName: string;
}

/**
 * Retrieves a valid "kind" for WebSiteModels.Site
 */
function GetSiteModelKind(kind: AppKind, os: WebsiteOS): string {
    var planKind: string;

    if (os === "linux") {
        // Linux does not appear to be supported for function apps at the moment
        return "linux";
    } else {
        // "app" or "functionapp"
        planKind = kind;
    }

    return planKind
}

/**
 * Retrieves a valid "kind" for WebSiteModels.AppServicePlan
 */
function GetAppServicePlanModelKind(_kind: AppKind, os: WebsiteOS): string {
    // Always create app plans, no matter what the website kind
    if (os === "linux") {
        return "linux";
    } else {
        return "app";
    }
}

function GetAppKindDisplayName(kind: AppKind): string {
    switch (kind) {
        case "app":
            return "Web App";
        case "functionapp":
            return "Function App";
        default:
            throw new RangeError();
    }
}
