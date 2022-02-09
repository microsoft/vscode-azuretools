/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AppServicePlan, WebSiteManagementClient } from '@azure/arm-appservice';
import { AzExtLocation, LocationListStep, ResourceGroupListStep, uiUtils } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardPromptStep, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions, nonNullProp } from '@microsoft/vscode-azext-utils';
import { webProvider } from '../constants';
import { localize } from '../localize';
import { tryGetAppServicePlan } from '../tryGetSiteResource';
import { createWebSiteClient } from '../utils/azureClients';
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

    public static async getPlans(context: IAppServiceWizardContext): Promise<AppServicePlan[]> {
        if (context.plansTask === undefined) {
            const client: WebSiteManagementClient = await createWebSiteClient(context);
            context.plansTask = uiUtils.listAllIterator(client.appServicePlans.list());
        }

        return await context.plansTask;
    }

    public static async isNameAvailable(context: IAppServiceWizardContext, name: string, resourceGroupName: string): Promise<boolean> {
        const plans: AppServicePlan[] = await AppServicePlanListStep.getPlans(context);
        return !plans.some(plan =>
            nonNullProp(plan, 'resourceGroup').toLowerCase() === resourceGroupName.toLowerCase() &&
            nonNullProp(plan, 'name').toLowerCase() === name.toLowerCase()
        );
    }

    public async prompt(context: IAppServiceWizardContext): Promise<void> {
        // Cache hosting plan separately per subscription
        // Logic Apps only supports Workflow Standard sku and for App Service Plan it only supports one Isolated sku.
        // Since create is not enabled for isolated skus, we explicitly reference the type of plan picked in the placeHolder.
        const options: IAzureQuickPickOptions = {
            placeHolder: context.newSiteKind?.includes(AppKind.workflowapp) && context.planSkuFamilyFilter?.test('IV2')
                ? localize('selectV3Plan', 'Select an App Service Environment (v3) Plan')
                : localize('selectPlan', 'Select a {0} App Service plan.', getWebsiteOSDisplayName(nonNullProp(context, 'newSiteOS'))),
            id: `AppServicePlanListStep/${context.subscriptionId}`
        };
        context.plan = (await context.ui.showQuickPick(this.getQuickPicks(context), options)).data;

        context.telemetry.properties.newPlan = String(!context.plan);
        if (context.plan) {
            await LocationListStep.setLocation(context, context.plan.location);
        }
    }

    public async getSubWizard(context: IAppServiceWizardContext): Promise<IWizardOptions<IAppServiceWizardContext> | undefined> {
        if (!context.plan) {
            const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [new AppServicePlanNameStep(), new AppServicePlanSkuStep(), new ResourceGroupListStep()];
            LocationListStep.addStep(context, promptSteps);
            return {
                promptSteps: promptSteps,
                executeSteps: [new AppServicePlanCreateStep()]
            };
        } else {
            context.valuesToMask.push(nonNullProp(context.plan, 'name'));
            return undefined;
        }
    }

    public shouldPrompt(context: IAppServiceWizardContext): boolean {
        return !context.plan && !context.newPlanName;
    }

    private async getQuickPicks(context: IAppServiceWizardContext): Promise<IAzureQuickPickItem<AppServicePlan | undefined>[]> {
        const picks: IAzureQuickPickItem<AppServicePlan | undefined>[] = !this._suppressCreate
            ? [{
                label: localize('CreateNewAppServicePlan', '$(plus) Create new App Service plan'),
                description: '',
                data: undefined
            }]
            : [];

        let plans: AppServicePlan[] = await AppServicePlanListStep.getPlans(context);
        const famFilter: RegExp | undefined = context.planSkuFamilyFilter;
        if (famFilter) {
            plans = plans.filter(plan => !plan.sku || !plan.sku.family || famFilter.test(plan.sku.family));
        }

        let location: AzExtLocation | undefined;
        if (LocationListStep.hasLocation(context)) {
            location = await LocationListStep.getLocation(context, webProvider);
        }

        let hasFilteredLocations: boolean = false;
        for (const plan of plans) {
            const isNewSiteLinux: boolean = context.newSiteOS === WebsiteOS.linux;
            let isPlanLinux: boolean = nonNullProp(plan, 'kind').toLowerCase().includes(WebsiteOS.linux);

            if (plan.sku && (plan.sku.family === 'EP' || plan.sku.family === 'WS')) {
                // elastic premium plans and workflow standard plans do not have the os in the kind, so we have to check the "reserved" property
                // also, the "reserved" property is always "false" in the list of plans returned above. We have to perform a separate get on each plan
                const client: WebSiteManagementClient = await createWebSiteClient(context);
                const epPlan: AppServicePlan | undefined = await tryGetAppServicePlan(client, nonNullProp(plan, 'resourceGroup'), nonNullProp(plan, 'name'));
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
                label: localize('hasFilteredLocations', '$(warning) Only plans in the region "{0}" are shown.', location.displayName),
                onPicked: () => { /* do nothing */ },
                data: undefined
            });
        }

        return picks;
    }
}
