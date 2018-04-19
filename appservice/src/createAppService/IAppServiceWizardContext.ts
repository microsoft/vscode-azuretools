/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, Site, SkuDescription } from 'azure-arm-website/lib/models';
import { IResourceGroupWizardContext, IStorageAccountWizardContext } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';

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
}
