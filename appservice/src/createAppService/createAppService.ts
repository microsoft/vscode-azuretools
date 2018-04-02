/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { OutputChannel } from 'vscode';
import { AzureWizard, AzureWizardStep, IActionContext, IAzureUserInput, LocationStep, ResourceGroupStep, StorageAccountStep } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';
import { AppServicePlanStep } from './AppServicePlanStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';
import { OSStep } from './OSStep';
import { SiteNameStep } from './SiteNameStep';
import { SiteStep } from './SiteStep';

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

    const steps: AzureWizardStep<IAppServiceWizardContext>[] = [];
    steps.push(new SiteNameStep());
    steps.push(new ResourceGroupStep());
    if (websiteOS === undefined) {
        steps.push(new OSStep());
    }
    switch (appKind) {
        case AppKind.functionapp:
            steps.push(new StorageAccountStep());
            break;
        case AppKind.app:
        default:
            steps.push(new AppServicePlanStep());
    }
    steps.push(new LocationStep());
    steps.push(new SiteStep());

    let wizardContext: IAppServiceWizardContext = {
        appKind: appKind,
        websiteOS: websiteOS,
        subscriptionId: subscriptionId,
        subscriptionDisplayName: subscriptionDisplayName,
        credentials: credentials
    };
    const wizard: AzureWizard<IAppServiceWizardContext> = new AzureWizard(steps, wizardContext);

    // Ideally actionContext should always be defined, but there's a bug with the NodePicker. Create a 'fake' actionContext until that bug is fixed
    // https://github.com/Microsoft/vscode-azuretools/issues/120
    actionContext = actionContext || <IActionContext>{ properties: {}, measurements: {} };
    wizardContext = await wizard.prompt(actionContext, ui);
    if (showCreatingNode) {
        showCreatingNode(wizardContext.siteName);
    }
    wizardContext = await wizard.execute(actionContext, outputChannel);

    return wizardContext.site;
}
