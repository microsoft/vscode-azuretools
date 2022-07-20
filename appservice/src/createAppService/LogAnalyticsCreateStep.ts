/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtLocation, getResourceGroupFromId, LocationListStep, uiUtils } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardExecuteStep, nonNullProp, nonNullValueAndProp } from "@microsoft/vscode-azext-utils";
import { Progress } from "vscode";
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { createOperationalInsightsManagementClient } from "../utils/azureClients";
import { AppInsightsCreateStep } from "./AppInsightsCreateStep";
import { IAppServiceWizardContext } from "./IAppServiceWizardContext";

export class LogAnalyticsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 134;

    public async execute(context: IAppServiceWizardContext, progress: Progress<{ message?: string | undefined; increment?: number | undefined }>): Promise<void> {
        const opClient = await createOperationalInsightsManagementClient(context);
        const rgName = nonNullValueAndProp(context.resourceGroup, 'name');
        const resourceLocation: AzExtLocation = await LocationListStep.getLocation(context);
        const aiStep = new AppInsightsCreateStep();
        const appInsightsLocation: string | undefined = await AppInsightsCreateStep.getSupportedLocation(aiStep, context, resourceLocation);

        if (!appInsightsLocation) {
            // if there is no supported AI location, then skip this as AppInsightsCreateStep will be skipped
            return;
        }
        
        const workspaces = await uiUtils.listAllIterator(opClient.workspaces.list());
        const workspacesInSameLoc = workspaces.filter(ws => ws.location === appInsightsLocation);
        const workspacesInSameRg = workspacesInSameLoc.filter(ws => getResourceGroupFromId(nonNullProp(ws, 'id')) === rgName);

        context.logAnalyticsWorkspace = workspacesInSameRg[0] ?? workspacesInSameLoc[0];
        
        if (context.logAnalyticsWorkspace) {   
            const usingLaw: string = localize('usingLogAnalyticsWorkspace', 'Using existing Log Analytics workspace "{0}"', context.logAnalyticsWorkspace.name);
            progress.report({ message: usingLaw });
            ext.outputChannel.appendLog(usingLaw);
        } else {
            const creatingLaw: string = localize('creatingLogAnalyticsWorkspace', 'Creating new Log Analytics workspace...');
            progress.report({ message: creatingLaw });
            ext.outputChannel.appendLog(creatingLaw);

            const workspaceName = `workspace-${context.newAppInsightsName}`
            context.logAnalyticsWorkspace = await opClient.workspaces.beginCreateOrUpdateAndWait(rgName, workspaceName, { location: appInsightsLocation });
    
            const createdLaw: string = localize('createdLogAnalyticWorkspace', 'Successfully created new Log Analytic workspace "{0}".',workspaceName );
            ext.outputChannel.appendLog(createdLaw);
            void progress.report({ message: createdLaw });
        }
    }

    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return !context.logAnalyticsWorkspace;
    }
}
