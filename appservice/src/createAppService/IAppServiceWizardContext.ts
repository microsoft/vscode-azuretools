/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan, Site } from 'azure-arm-website/lib/models';
import { IResourceGroupWizardContext, IStorageAccountWizardContext } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';

export interface IAppServiceWizardContext extends IResourceGroupWizardContext, IStorageAccountWizardContext {
    appKind: AppKind;
    websiteOS: WebsiteOS;

    /**
     * The newly created site
     * This will be defined after `SiteStep.execute` occurs.
     */
    site?: Site;

    /**
     * The name of the new site
     * This will be defined after `SiteNameStep.prompt` occurs.
     */
    siteName?: string;

    /**
     * The App Service plan to use.
     * If an existing plan is picked, this value will be defined after `AppServicePlanStep.prompt` occurs
     * If a new plan is picked, this value will be defined after `AppServicePlanStep.execute` occurs
     */
    plan?: AppServicePlan;

    /**
     * The task used to get existing plans.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    plansTask?: Promise<AppServicePlan[]>;
}
