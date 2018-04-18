/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { OutputChannel } from 'vscode';
import { AzureWizard, AzureWizardPromptStep, IActionContext, IAzureUserInput, LocationListStep, ResourceGroupListStep, StorageAccountKind, StorageAccountListStep, StorageAccountPerformance, StorageAccountReplication } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';
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
    showCreatingNode?: (label: string) => void): Promise<Site> {

    const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [];
    promptSteps.push(new SiteNameStep());
    promptSteps.push(new ResourceGroupListStep());
    promptSteps.push(new SiteOSStep());
    promptSteps.push(new SiteRuntimeStep());
    switch (appKind) {
        case AppKind.functionapp:
            promptSteps.push(new StorageAccountListStep(StorageAccountKind.Storage, StorageAccountPerformance.Standard, StorageAccountReplication.LRS));
            break;
        case AppKind.app:
        default:
            promptSteps.push(new AppServicePlanListStep());
    }
    promptSteps.push(new LocationListStep());

    let wizardContext: IAppServiceWizardContext = {
        newSiteKind: appKind,
        newSiteOS: websiteOS,
        subscriptionId: subscriptionId,
        subscriptionDisplayName: subscriptionDisplayName,
        credentials: credentials
    };
    const wizard: AzureWizard<IAppServiceWizardContext> = new AzureWizard(promptSteps, [new SiteCreateStep()], wizardContext);

    // Ideally actionContext should always be defined, but there's a bug with the NodePicker. Create a 'fake' actionContext until that bug is fixed
    // https://github.com/Microsoft/vscode-azuretools/issues/120
    actionContext = actionContext || <IActionContext>{ properties: {}, measurements: {} };
    wizardContext = await wizard.prompt(actionContext, ui);
    if (showCreatingNode) {
        showCreatingNode(wizardContext.newSiteName);
    }
    wizardContext = await wizard.execute(actionContext, outputChannel);

    return wizardContext.site;
}
