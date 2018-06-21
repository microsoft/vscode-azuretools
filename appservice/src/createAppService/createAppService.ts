/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site, SkuDescription } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { OutputChannel, Uri, workspace } from 'vscode';
import { AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, IActionContext, IAzureUserInput, LocationListStep, ResourceGroupCreateStep, ResourceGroupListStep, StorageAccountKind, StorageAccountListStep, StorageAccountPerformance, StorageAccountReplication } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';
import { AppServicePlanCreateStep } from './AppServicePlanCreateStep';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';
import { SiteCreateStep } from './SiteCreateStep';
import { SiteNameStep } from './SiteNameStep';
import { SiteOSStep } from './SiteOSStep';
import { SiteRuntimeStep } from './SiteRuntimeStep';

export async function createAppService(
    appKind: AppKind,
    websiteOS: WebsiteOS | undefined,
    outputChannel: OutputChannel,
    ui: IAzureUserInput,
    actionContext: IActionContext,
    credentials: ServiceClientCredentials,
    subscriptionId: string,
    subscriptionDisplayName: string,
    showCreatingNode?: (label: string) => void,
    advancedCreation: boolean = false): Promise<Site> {

    const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [];
    const executeSteps: AzureWizardExecuteStep<IAppServiceWizardContext>[] = [];
    let wizardContext: IAppServiceWizardContext = {
        newSiteKind: appKind,
        newSiteOS: websiteOS,
        subscriptionId: subscriptionId,
        subscriptionDisplayName: subscriptionDisplayName,
        credentials: credentials
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
            promptSteps.push(new AppServicePlanListStep());
            promptSteps.push(new LocationListStep());
            break;
        case AppKind.app:
            if (advancedCreation) {
                promptSteps.push(new ResourceGroupListStep());
                promptSteps.push(new SiteOSStep());
                promptSteps.push(new SiteRuntimeStep());
                promptSteps.push(new AppServicePlanListStep());
                promptSteps.push(new LocationListStep());
            } else {
                if (workspace.workspaceFolders.length === 1) {
                    // can make smart defaults if only one workspace is opened
                    await setWizardContextDefaults(wizardContext);
                }
                promptSteps.push(new LocationListStep());
                promptSteps.push(new SiteOSStep()); // will be skipped with a smart default
                promptSteps.push(new SiteRuntimeStep()); // will be skipped with a smart default
                executeSteps.push(new ResourceGroupCreateStep());
                executeSteps.push(new AppServicePlanCreateStep());
            }
        default:
    }
    executeSteps.push(new SiteCreateStep());
    const wizard: AzureWizard<IAppServiceWizardContext> = new AzureWizard(promptSteps, executeSteps, wizardContext);

    // Ideally actionContext should always be defined, but there's a bug with the NodePicker. Create a 'fake' actionContext until that bug is fixed
    // https://github.com/Microsoft/vscode-azuretools/issues/120
    actionContext = actionContext || <IActionContext>{ properties: {}, measurements: {} };
    wizardContext = await wizard.prompt(actionContext, ui);
    if (showCreatingNode) {
        showCreatingNode(wizardContext.newSiteName);
    }
    if (!advancedCreation) {
        const basicPlanSku: SkuDescription = { name: 'B1', tier: 'Basic', size: 'B1', family: 'B', capacity: 1 };
        const freePlanSku: SkuDescription = { name: 'F1', tier: 'Free', size: 'F1', family: 'F', capacity: 1 };
        wizardContext.newResourceGroupName = `appsvc_rg_${wizardContext.newSiteOS}_${wizardContext.location.name}`;
        wizardContext.newPlanName = `appsvc_asp_${wizardContext.newSiteOS}_${wizardContext.location.name}`;
        // Free tier is only available for Windows
        wizardContext.newPlanSku = wizardContext.newSiteOS === WebsiteOS.windows ? freePlanSku : basicPlanSku;
    }
    wizardContext = await wizard.execute(actionContext, outputChannel);

    return wizardContext.site;
}

async function setWizardContextDefaults(wizardContext: IAppServiceWizardContext): Promise<void> {
    await workspace.findFiles('package.json').then((files: Uri[]) => {
        if (files.length > 0) {
            wizardContext.newSiteOS = WebsiteOS.linux;
            wizardContext.newSiteRuntime = 'node|8.9';
        }
    });

    await workspace.findFiles('*.csproj').then((files: Uri[]) => {
        if (files.length > 0) {
            wizardContext.newSiteOS = WebsiteOS.windows;
        }
    });
}
