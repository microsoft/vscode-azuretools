/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient, WebSiteManagementMappers, WebSiteManagementModels } from '@azure/arm-appservice';
import { MessageItem, Progress } from 'vscode';
import { AzExtLocation, AzureWizardExecuteStep, LocationListStep, parseError } from 'vscode-azureextensionui';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { webProvider } from '../constants';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { tryGetAppServicePlan } from '../tryGetSiteResource';
import { createWebSiteClient } from '../utils/azureClients';
import { nonNullProp, nonNullValueAndProp } from '../utils/nonNull';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 120;

    public async execute(wizardContext: IAppServiceWizardContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        const newPlanName: string = nonNullProp(wizardContext, 'newPlanName');
        const rgName: string = nonNullValueAndProp(wizardContext.resourceGroup, 'name');

        const findingAppServicePlan: string = localize('FindingAppServicePlan', 'Ensuring App Service plan "{0}" exists...', newPlanName);
        const creatingAppServicePlan: string = localize('CreatingAppServicePlan', 'Creating App Service plan "{0}"...', newPlanName);
        const foundAppServicePlan: string = localize('FoundAppServicePlan', 'Successfully found App Service plan "{0}".', newPlanName);
        const createdAppServicePlan: string = localize('CreatedAppServicePlan', 'Successfully created App Service plan "{0}".', newPlanName);
        ext.outputChannel.appendLog(findingAppServicePlan);

        try {
            const client: WebSiteManagementClient = await createWebSiteClient(wizardContext);
            const existingPlan: WebSiteManagementModels.AppServicePlan | undefined = await tryGetAppServicePlan(client, rgName, newPlanName);

            if (existingPlan) {
                wizardContext.plan = existingPlan;
                ext.outputChannel.appendLog(foundAppServicePlan);
            } else {
                ext.outputChannel.appendLog(creatingAppServicePlan);
                progress.report({ message: creatingAppServicePlan });

                const location: AzExtLocation = await LocationListStep.getLocation(wizardContext, webProvider);
                const skuFamily = wizardContext.newPlanSku?.family ? wizardContext.newPlanSku?.family.toLowerCase() : '';
                const isElasticPremiumOrWorkflowStandard: boolean = skuFamily === 'ep' || skuFamily === 'ws';
                wizardContext.plan = await client.appServicePlans.createOrUpdate(rgName, newPlanName, <ExtendedAppServicePlan>{
                    kind: getPlanKind(wizardContext),
                    sku: nonNullProp(wizardContext, 'newPlanSku'),
                    location: location.name,
                    reserved: wizardContext.newSiteOS === WebsiteOS.linux,  // The secret property - must be set to true to make it a Linux plan. Confirmed by the team who owns this API.
                    maximumElasticWorkerCount: isElasticPremiumOrWorkflowStandard ? 20 : undefined,
                    kubeEnvironmentProfile: getKubeProfile(wizardContext),
                    perSiteScaling: !!wizardContext.customLocation
                });
                ext.outputChannel.appendLog(createdAppServicePlan);
            }
        } catch (e) {
            if (parseError(e).errorType === 'AuthorizationFailed') {
                await this.selectExistingPrompt(wizardContext);
            } else {
                throw e;
            }
        }


    }

    public async selectExistingPrompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        const message: string = localize('planForbidden', 'You do not have permission to create an app service plan in subscription "{0}".', wizardContext.subscriptionDisplayName);
        const selectExisting: MessageItem = { title: localize('selectExisting', 'Select Existing') };
        wizardContext.telemetry.properties.cancelStep = 'AspNoPermissions';
        await wizardContext.ui.showWarningMessage(message, { modal: true }, selectExisting);

        wizardContext.telemetry.properties.cancelStep = undefined;
        wizardContext.telemetry.properties.forbiddenResponse = 'SelectExistingAsp';
        const step: AppServicePlanListStep = new AppServicePlanListStep(true /* suppressCreate */);
        await step.prompt(wizardContext);
    }

    public shouldExecute(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.plan;
    }
}

function getKubeProfile(wizardContext: IAppServiceWizardContext) {
    if (wizardContext.customLocation) {
        // Temporary workaround so that the sdk allows "kubeEnvironmentProfile" on the plan
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        WebSiteManagementMappers.AppServicePlan.type.modelProperties!.kubeEnvironmentProfile = {
            serializedName: 'properties.kubeEnvironmentProfile',
            type: {
                name: "Composite",
                modelProperties: {
                    id: {
                        serializedName: "id",
                        type: {
                            name: "String"
                        }
                    }
                }
            }
        };

        return { id: wizardContext.customLocation.kubeEnvironment.id };
    } else {
        return undefined;
    }
}

interface ExtendedAppServicePlan extends WebSiteManagementModels.AppServicePlan {
    kubeEnvironmentProfile?: {
        id: string;
    }
}

function getPlanKind(wizardContext: IAppServiceWizardContext): string {
    if (wizardContext.customLocation) {
        return 'linux,kubernetes';
    } else if (wizardContext.newSiteOS === WebsiteOS.linux) {
        return WebsiteOS.linux;
    } else {
        return AppKind.app;
    }
}
