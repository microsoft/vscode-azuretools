/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementModels } from '@azure/arm-appservice';
import { AzExtLocation, AzureWizardPromptStep, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions, LocationListStep, ResourceGroupListStep } from 'vscode-azureextensionui';
import { webProvider } from '../constants';
import { localize } from '../localize';
import { tryGetAppServicePlan } from '../tryGetSiteResource';
import { createWebSiteClient } from '../utils/azureClients';
import { nonNullProp } from '../utils/nonNull';
import { uiUtils } from '../utils/uiUtils';
import { AppKind, getWebsiteOSDisplayName, WebsiteOS } from './AppKind';
import { AppServicePlanCreateStep } from './AppServicePlanCreateStep';
import { AppServicePlanNameStep } from './AppServicePlanNameStep';
import { AppServicePlanSkuStep } from './AppServicePlanSkuStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanListStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    private _suppressCreate: boolean | undefined;

    public constructor(suppressCreate?: boolean) {
        super();
        this._suppressCreate = suppressCreate;
    }

    public static async getPlans(wizardContext: IAppServiceWizardContext): Promise<WebSiteManagementModels.AppServicePlan[]> {
        if (wizardContext.plansTask === undefined) {
            const client: WebSiteManagementClient = await createWebSiteClient(wizardContext);
            wizardContext.plansTask = uiUtils.listAll(client.appServicePlans, client.appServicePlans.list());
        }

        return await wizardContext.plansTask;
    }

    public static async isNameAvailable(wizardContext: IAppServiceWizardContext, name: string, resourceGroupName: string): Promise<boolean> {
        const plans: WebSiteManagementModels.AppServicePlan[] = await AppServicePlanListStep.getPlans(wizardContext);
        return !plans.some(plan =>
            nonNullProp(plan, 'resourceGroup').toLowerCase() === resourceGroupName.toLowerCase() &&
            nonNullProp(plan, 'name').toLowerCase() === name.toLowerCase()
        );
    }

    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        // Cache hosting plan separately per subscription
        // Logic Apps only supports Workflow Standard sku and for App Service Plan it only supports one Isolated sku.
        // Since create is not enabled for isolated skus, we explicitly reference the type of plan picked in the placeHolder.
        const options: IAzureQuickPickOptions = {
            placeHolder: wizardContext.newSiteKind?.includes(AppKind.workflowapp) && wizardContext.planSkuFamilyFilter?.test('IV2')
                ? localize('selectV3Plan', 'Select an App Service Environment (v3) Plan')
                : localize('selectPlan', 'Select a {0} App Service plan.', getWebsiteOSDisplayName(nonNullProp(wizardContext, 'newSiteOS'))),
            id: `AppServicePlanListStep/${wizardContext.subscriptionId}`
        };
        wizardContext.plan = (await wizardContext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;

        wizardContext.telemetry.properties.newPlan = String(!wizardContext.plan);
        if (wizardContext.plan) {
            await LocationListStep.setLocation(wizardContext, wizardContext.plan.location);
        }
    }

    public async getSubWizard(wizardContext: IAppServiceWizardContext): Promise<IWizardOptions<IAppServiceWizardContext> | undefined> {
        if (!wizardContext.plan) {
            const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [new AppServicePlanNameStep(), new AppServicePlanSkuStep(), new ResourceGroupListStep()];
            LocationListStep.addStep(wizardContext, promptSteps);
            return {
                promptSteps: promptSteps,
                executeSteps: [new AppServicePlanCreateStep()]
            };
        } else {
            wizardContext.valuesToMask.push(nonNullProp(wizardContext.plan, 'name'));
            return undefined;
        }
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.plan && !wizardContext.newPlanName;
    }

    private async getQuickPicks(wizardContext: IAppServiceWizardContext): Promise<IAzureQuickPickItem<WebSiteManagementModels.AppServicePlan | undefined>[]> {
        const picks: IAzureQuickPickItem<WebSiteManagementModels.AppServicePlan | undefined>[] = !this._suppressCreate
            ? [{
                label: localize('CreateNewAppServicePlan', '$(plus) Create new App Service plan'),
                description: '',
                data: undefined
            }]
            : [];

        let plans: WebSiteManagementModels.AppServicePlan[] = await AppServicePlanListStep.getPlans(wizardContext);
        const famFilter: RegExp | undefined = wizardContext.planSkuFamilyFilter;
        if (famFilter) {
            plans = plans.filter(plan => !plan.sku || !plan.sku.family || famFilter.test(plan.sku.family));
        }

        let location: AzExtLocation | undefined;
        if (LocationListStep.hasLocation(wizardContext)) {
            location = await LocationListStep.getLocation(wizardContext, webProvider);
        }

        let hasFilteredLocations: boolean = false;
        for (const plan of plans) {
            const isNewSiteLinux: boolean = wizardContext.newSiteOS === WebsiteOS.linux;
            let isPlanLinux: boolean = nonNullProp(plan, 'kind').toLowerCase().includes(WebsiteOS.linux);

            if (plan.sku && (plan.sku.family === 'EP' || plan.sku.family === 'WS')) {
                // elastic premium plans and workflow standard plans do not have the os in the kind, so we have to check the "reserved" property
                // also, the "reserved" property is always "false" in the list of plans returned above. We have to perform a separate get on each plan
                const client: WebSiteManagementClient = await createWebSiteClient(wizardContext);
                const epPlan: WebSiteManagementModels.AppServicePlan | undefined = await tryGetAppServicePlan(client, nonNullProp(plan, 'resourceGroup'), nonNullProp(plan, 'name'));
                isPlanLinux = !!epPlan?.reserved;
            }

            // plan.kind will contain "linux" for Linux plans, but will _not_ contain "windows" for Windows plans. Thus we check "isLinux" for both cases
            if (isNewSiteLinux === isPlanLinux) {
                if (location && !LocationListStep.locationMatchesName(location, plan.location)) {
                    hasFilteredLocations = true;
                } else {
                    picks.push({
                        id: plan.id,
                        label: nonNullProp(plan, 'name'),
                        description: plan.sku?.name,
                        data: plan
                    });
                }
            }
        }

        if (hasFilteredLocations && location) {
            picks.push({
                label: localize('hasFilteredLocations', '$(warning) Only plans in the selected region "{0}" are shown.', location.displayName),
                onPicked: () => { /* do nothing */ },
                data: undefined
            });
        }

        return picks;
    }
}
