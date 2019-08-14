/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsComponent, ApplicationInsightsComponentListResult } from 'azure-arm-appinsights/lib/models';
import { AppServicePlan, Site, SkuDescription } from 'azure-arm-website/lib/models';
import { IResourceGroupWizardContext, IStorageAccountWizardContext } from 'vscode-azureextensionui';
import { skipForNow } from './AppInsightsListStep';
import { AppKind, LinuxRuntimes, WebsiteOS } from './AppKind';

export interface IAppServiceWizardContext extends IResourceGroupWizardContext, IStorageAccountWizardContext {
    newSiteKind: AppKind;

    /**
     * The OS for the new site
     * This will be defined after `SiteOSStep.prompt` occurs.
     */
    newSiteOS?: WebsiteOS;

    /**
     * The runtime for a new Linux site
     * This will be defined after `SiteRuntimeStep.prompt` occurs.
     */
    newSiteRuntime?: string;

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
     * The task used to get existing plans.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    plansTask?: Promise<AppServicePlan[]>;

    /**
     * The runtimes to put to the top of the QuickPick list to recommend to the user.
     * In the array, Higher ranking means higher priority, thus will have higher position in the QuickPick list.
     * This should be set by the extension
     */

    recommendedSiteRuntime?: LinuxRuntimes[];

    /**
     * App Insights components are necessary for Function apps log streaming.  By default, we should instantiate
     * one for the user if there is a data farm available within the same region as the web app
     * The string value is reserved for "skipForNow" which is used to skip creating an AI component
     */
    appInsightsComponent?: ApplicationInsightsComponent;

    /**
     * The task used to get existing App Insights components.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    appInsightsTask?: Promise<ApplicationInsightsComponentListResult>;

    /**
     * Boolean indicating that the user opted out of creating an Application inisghts component.
     * Should be set in the AppInsightsListStep so any checks should be after that
     */
    appInsightsSkip?: boolean;

    /**
     * The name of the new App Insights component
     * This will be defined after `AppInsightsNameStep.prompt` occurs.
     */
    newAppInsightsName?: string;

    /**
     * The location of the new App Insights component
     * This will be defined after `AppInsightsLocationStep.prompt` occurs.
     */
    newAppInsightsLocation?: string;
}
