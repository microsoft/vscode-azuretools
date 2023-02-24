/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtLocation, getResourceGroupFromId, LocationListStep, uiUtils } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardExecuteStep, nonNullProp, nonNullValueAndProp } from "@microsoft/vscode-azext-utils";
import { l10n, Progress } from "vscode";
import { ext } from "../extensionVariables";
import { createOperationalInsightsManagementClient } from "../utils/azureClients";
import { getAppInsightsSupportedLocation } from "./getAppInsightsSupportedLocation";
import { IAppServiceWizardContext } from "./IAppServiceWizardContext";

export class LogAnalyticsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext> {
    public priority: number = 134;

    public async execute(context: IAppServiceWizardContext, progress: Progress<{ message?: string | undefined; increment?: number | undefined }>): Promise<void> {
        const opClient = await createOperationalInsightsManagementClient(context);
        const rgName = nonNullValueAndProp(context.resourceGroup, 'name');
        const resourceLocation: AzExtLocation = await LocationListStep.getLocation(context);
        const location = await getAppInsightsSupportedLocation(context, resourceLocation);

        if (!location) {
            // if there is no supported AI location, then skip this as AppInsightsCreateStep will be skipped
            return;
        }

        const workspaces = await uiUtils.listAllIterator(opClient.workspaces.list());
        const workspacesInSameLoc = workspaces.filter(ws => ws.location === location);
        const workspacesInSameRg = workspacesInSameLoc.filter(ws => getResourceGroupFromId(nonNullProp(ws, 'id')) === rgName);

        context.logAnalyticsWorkspace = workspacesInSameRg[0] ?? workspacesInSameLoc[0];

        if (context.logAnalyticsWorkspace) {
            const usingLaw: string = l10n.t('Using existing Log Analytics workspace "{0}"', context.logAnalyticsWorkspace.name!);
            progress.report({ message: usingLaw });
            ext.outputChannel.appendLog(usingLaw);
        } else {
            const creatingLaw: string = l10n.t('Creating new Log Analytics workspace...');
            progress.report({ message: creatingLaw });
            ext.outputChannel.appendLog(creatingLaw);
            const workspaceName = `workspace-${context.newAppInsightsName}`
            const createdLaw: string = l10n.t('Successfully created new Log Analytics workspace "{0}".', workspaceName);
            ext.outputChannel.appendLog(createdLaw);
            progress.report({ message: createdLaw });
            context.logAnalyticsWorkspace = await opClient.workspaces.beginCreateOrUpdateAndWait(rgName, workspaceName, { location });
        }
    }

    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return !context.logAnalyticsWorkspace;
    }
}
