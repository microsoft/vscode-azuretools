/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site, SkuDescription } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { OutputChannel } from 'vscode';
import { AzureWizard, AzureWizardPromptStep, IActionContext, IAzureUserInput, LocationListStep, ResourceGroupListStep, StorageAccountKind, StorageAccountListStep, StorageAccountPerformance, StorageAccountReplication } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';
import { SetWizardContextPropertyStep } from './SetWizardContextPropertyStep';
import { SiteCreateStep } from './SiteCreateStep';
import { SiteNameStep } from './SiteNameStep';
import { SiteOSStep } from './SiteOSStep';
import { SiteRuntimeStep } from './SiteRuntimeStep';
import * as find from 'find';

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
    fsPath?: string,
    improvedCreation: boolean = false): Promise<Site> {

    let wizardContext: IAppServiceWizardContext = {
        newSiteKind: appKind,
        newSiteOS: websiteOS,
        subscriptionId: subscriptionId,
        subscriptionDisplayName: subscriptionDisplayName,
        credentials: credentials
    };

    const promptSteps: AzureWizardPromptStep<IAppServiceWizardContext>[] = [];
    promptSteps.push(new SiteNameStep());
    promptSteps.push(new LocationListStep());
    promptSteps.push(new SiteOSStep());
    promptSteps.push(new SiteRuntimeStep());
    if (improvedCreation) {
        const setResourceGroupProperty: Function = (): string => {
            if (wizardContext.location && wizardContext.newSiteOS) {
                return `appsvc_rg_${wizardContext.newSiteOS}_${wizardContext.location.name}`;
            } else {
                return '';
            }
        };

        const setAppServicePlanProperty: Function = (): string => {
            if (wizardContext.location && wizardContext.newSiteOS) {
                return `appsvc_asp_${wizardContext.newSiteOS}_${wizardContext.location.name}`;
            } else {
                return '';
            }
        };

        setDefaultsForImprovedConfiguration(wizardContext, fsPath);
        promptSteps.push(new SetWizardContextPropertyStep('newResourceGroupName', setResourceGroupProperty));
        promptSteps.push(new SetWizardContextPropertyStep('newPlanName', setAppServicePlanProperty));
        const basicSku: SkuDescription = {
            name: 'B1',
            tier: 'Basic',
            size: 'B1',
            family: 'B',
            capacity: 1
        };
        promptSteps.push(new SetWizardContextPropertyStep('newPlanSku', basicSku));
    }
    switch (appKind) {
        case AppKind.functionapp:
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
        default:
            promptSteps.push(new ResourceGroupListStep());
            promptSteps.push(new AppServicePlanListStep());
    }

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

function setDefaultsForImprovedConfiguration(wizardContext: IAppServiceWizardContext, fsPath: string): void {
    const files: string[] = find.fileSync(fsPath);
    for (const file of files) {
        if (file.indexOf('package.json') >= 0) {
            wizardContext.newSiteOS = WebsiteOS.linux;
            wizardContext.newSiteRuntime = 'node|8.9';
            break;
        }

        if (file.split('.').pop() === 'csproj') {
            wizardContext.newSiteOS = WebsiteOS.windows;
            break;
        }
    }
}
