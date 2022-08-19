/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ApplicationInsightsComponent } from '@azure/arm-appinsights';
import type { AppServicePlan, Site, SkuDescription } from '@azure/arm-appservice';
import type { Workspace } from '@azure/arm-operationalinsights';
import { IResourceGroupWizardContext, IStorageAccountWizardContext } from '@microsoft/vscode-azext-azureutils';
import { AppKind, WebsiteOS } from './AppKind';

export interface IAppServiceWizardContext extends IResourceGroupWizardContext, IStorageAccountWizardContext {
    newSiteKind: AppKind;

    /**
     * The OS for the new site
     * This will be defined after `SiteOSStep.prompt` occurs.
     */
    newSiteOS?: WebsiteOS;

    /**
     * The newly created site
     * This will be defined after `SiteCreateStep.execute` occurs.
     */
    site?: Site;

    /**
     * The name of the new site
     * This will be defined after `SiteNameStep.prompt` occurs.
     */
    newSiteName?: string;

    /**
     * The App Service plan to use.
     * If an existing plan is picked, this value will be defined after `AppServicePlanListStep.prompt` occurs
     * If a new plan is picked, this value will be defined after the `execute` phase of the 'create' subwizard
     */
    plan?: AppServicePlan;

    /**
     * Whether or not to use a consumption plan
     * This will be defined after `SiteHostingPlanStep.prompt` occurs.
     */
    useConsumptionPlan?: boolean;

    /**
     * The name of the new plan
     * This will be defined after `AppServicePlanNameStep.prompt` occurs.
     */
    newPlanName?: string;

    /**
     * The sku of the new plan
     * This will be defined after `AppServicePlanSkuStep.prompt` occurs.
     */
    newPlanSku?: SkuDescription;

    /**
     * If specified, only skus matching this filter will be shown
     */
    planSkuFamilyFilter?: RegExp;

    /**
     * The task used to get existing plans.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    plansTask?: Promise<AppServicePlan[]>;

    /**
     * App Insights components are necessary for Function apps log streaming.  By default, we should instantiate
     * one for the user if there is a data farm available within the same region as the web app
     */
    appInsightsComponent?: ApplicationInsightsComponent;

    /**
     * The task used to get existing App Insights components.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    appInsightsTask?: Promise<ApplicationInsightsComponent[]>;

    /**
     * Boolean indicating that the user opted out of creating an Application inisghts component.
     * This will be defined after `AppInsightsLocationStep.prompt` occurs.
     */
    appInsightsSkip?: boolean;

    /**
     * The name of the new App Insights component
     * This will be defined after `AppInsightsNameStep.prompt` occurs.
     */
    newAppInsightsName?: string;

    /**
     * Log Anayltics Workspace component is neccessary for the new App Insights components. By default,
     * it will look for a workspace within the same resource group and location as the App Insight
     * component. If neither conditions are met, then it will automatically create a workspace
     */
    logAnalyticsWorkspace?: Workspace;

    /**
     * Indicates advanced creation should be used
     */
    advancedCreation?: boolean;

    customLocation?: CustomLocation;

    /**
     * The zone redundancy availability of the new plan
     * Specifies wheter the ASP will be zone redundant
     */
    zoneRedundant?: boolean;
}

export type CustomLocation = {
    name: string;
    id: string;
    kubeEnvironment: {
        name: string;
        id: string;
        location: string;
    }
}
