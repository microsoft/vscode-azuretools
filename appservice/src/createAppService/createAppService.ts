/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Location } from 'azure-arm-resource/lib/subscription/models';
import { Site, SkuDescription } from 'azure-arm-website/lib/models';
import { AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, IActionContext, ISubscriptionWizardContext, ResourceGroupCreateStep, ResourceGroupListStep, StorageAccountKind, StorageAccountListStep, StorageAccountPerformance, StorageAccountReplication } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { AppKind, WebsiteOS } from './AppKind';
import { AppServicePlanCreateStep } from './AppServicePlanCreateStep';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { setWizardContextDefaults } from './createWebApp';
import { IAppCreateOptions } from './IAppCreateOptions';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';
import { SiteCreateStep } from './SiteCreateStep';
import { SiteNameStep } from './SiteNameStep';
import { SiteOSStep } from './SiteOSStep';
import { SiteRuntimeStep } from './SiteRuntimeStep';

export async function createAppService(
    appKind: AppKind,
    actionContext: IActionContext,
    subscriptionContext: ISubscriptionWizardContext,
    createOptions: IAppCreateOptions | undefined,
    showCreatingTreeItem?: (label: string) => void): Promise<Site> {
    // tslint:disable-next-line:strict-boolean-expressions
    createOptions = createOptions || {};
    // Ideally actionContext should always be defined, but there's a bug with the TreeItemPicker. Create a 'fake' actionContext until that bug is fixed
    // https://github.com/Microsoft/vscode-azuretools/issues/120
    // tslint:disable-next-line:strict-boolean-expressions
    actionContext = actionContext || <IActionContext>{ properties: {}, measurements: {} };

    const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [];
    const executeSteps: AzureWizardExecuteStep<IAppServiceWizardContext>[] = [];
    const wizardContext: IAppServiceWizardContext = {
        newSiteKind: appKind,
        newSiteOS: createOptions.os ? WebsiteOS[createOptions.os] : undefined,
        newSiteRuntime: createOptions.runtime,
        subscriptionId: subscriptionContext.subscriptionId,
        subscriptionDisplayName: subscriptionContext.subscriptionDisplayName,
        credentials: subscriptionContext.credentials,
        environment: subscriptionContext.environment,
        newResourceGroupName: createOptions.resourceGroup,
        resourceGroupDeferLocationStep: true
    };

    promptSteps.push(new SiteNameStep());
    switch (appKind) {
        // Functions app will not use streamlined experience
        case AppKind.functionapp:
            promptSteps.push(new ResourceGroupListStep());
            promptSteps.push(new SiteOSStep());
            promptSteps.push(new SiteRuntimeStep());
            promptSteps.push(new StorageAccountListStep(
                {
                    kind: StorageAccountKind.Storage,
                    performance: StorageAccountPerformance.Standard,
                    replication: StorageAccountReplication.LRS
                },
                {
                    kind: [
                        StorageAccountKind.BlobStorage
                    ],
                    performance: [
                        StorageAccountPerformance.Premium
                    ],
                    replication: [
                        StorageAccountReplication.ZRS
                    ],
                    learnMoreLink: 'https://aka.ms/Cfqnrc'
                }
            ));
            break;
        case AppKind.app:
            await setWizardContextDefaults(wizardContext, actionContext, createOptions.advancedCreation);
            if (createOptions.advancedCreation) {
                promptSteps.push(new ResourceGroupListStep());
                promptSteps.push(new SiteOSStep());
                promptSteps.push(new SiteRuntimeStep());
                promptSteps.push(new AppServicePlanListStep());
            } else {
                promptSteps.push(new SiteOSStep()); // will be skipped if there is a smart default
                promptSteps.push(new SiteRuntimeStep());
                executeSteps.push(new ResourceGroupCreateStep());
                executeSteps.push(new AppServicePlanCreateStep());
            }
        default:
    }
    executeSteps.push(new SiteCreateStep(createOptions.createFunctionAppSettings));

    if (wizardContext.newSiteOS !== undefined) {
        SiteOSStep.setLocationsTask(wizardContext);
    }

    const title: string = wizardContext.newSiteKind === AppKind.functionapp ?
        localize('functionAppCreatingTitle', 'Create new function app.') :
        localize('webAppCreatingTitle', 'Create new web app.');
    const wizard: AzureWizard<IAppServiceWizardContext> = new AzureWizard(wizardContext, { promptSteps, executeSteps, title, showExecuteProgress: true });

    await wizard.prompt(actionContext);
    if (showCreatingTreeItem) {
        showCreatingTreeItem(nonNullProp(wizardContext, 'newSiteName'));
    }
    if (wizardContext.newSiteKind === AppKind.app && !createOptions.advancedCreation) {
        const location: Location = nonNullProp(wizardContext, 'location');
        const basicPlanSku: SkuDescription = { name: 'B1', tier: 'Basic', size: 'B1', family: 'B', capacity: 1 };
        const freePlanSku: SkuDescription = { name: 'F1', tier: 'Free', size: 'F1', family: 'F', capacity: 1 };
        wizardContext.newResourceGroupName = `appsvc_rg_${wizardContext.newSiteOS}_${location.name}`;
        wizardContext.newPlanName = `appsvc_asp_${wizardContext.newSiteOS}_${location.name}`;
        // Java Web Apps need P1v2 as default, which the newPlanSku for has been preset before.
        if (!wizardContext.newPlanSku) {
            // Free tier is only available for Windows
            wizardContext.newPlanSku = wizardContext.newSiteOS === WebsiteOS.windows ? freePlanSku : basicPlanSku;
        }
    }

    await wizard.execute(actionContext);

    actionContext.properties.os = wizardContext.newSiteOS;
    actionContext.properties.runtime = wizardContext.newSiteRuntime;
    actionContext.properties.advancedCreation = createOptions.advancedCreation ? 'true' : 'false';
    return nonNullProp(wizardContext, 'site');
}
