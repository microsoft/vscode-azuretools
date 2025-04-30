/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtLocation, getResourceGroupFromId, LocationListStep, uiUtils } from "@microsoft/vscode-azext-azureutils";
import { AzureWizardExecuteStep, ExecuteActivityContext, nonNullProp, nonNullValueAndProp } from "@microsoft/vscode-azext-utils";
import { l10n, Progress } from "vscode";
import { createOperationalInsightsManagementClient } from "../utils/azureClients";
import { getAppInsightsSupportedLocation } from "./getAppInsightsSupportedLocation";
import { IAppServiceWizardContext } from "./IAppServiceWizardContext";

export class LogAnalyticsCreateStep extends AzureWizardExecuteStep<IAppServiceWizardContext & Partial<ExecuteActivityContext>> {
    public priority: number = 134;
    public stepName = 'LogAnalyticsCreateStep';
    private _usedExistingLaw: boolean = false;
    private _skippedCreate: boolean = false;

    protected getTreeItemLabel(context: IAppServiceWizardContext): string {
        const workspaceName = `workspace-${context.newAppInsightsName}`
        let message = l10n.t('Create log analytics workspace "{0}"', workspaceName);
        if (this._skippedCreate) {
            message = l10n.t('Skipping log analytics workspace creation.');
        } else if (this._usedExistingLaw) {
            message = l10n.t('Using existing log analytics workspace "{0}"', workspaceName);
        }
        return message;
    }
    protected getOutputLogSuccess(context: IAppServiceWizardContext): string {
        const workspaceName = `workspace-${context.newAppInsightsName}`
        let message = l10n.t('Successfully created log analytics workspace "{0}".', workspaceName);
        if (this._skippedCreate) {
            message = l10n.t('Skipped creating log analytics workspace.');
        } else if (this._usedExistingLaw) {
            message = l10n.t('Successfully found existing log analytics workspace "{0}".', workspaceName);
        }
        return message;
    }
    protected getOutputLogFail(context: IAppServiceWizardContext): string {
        const workspaceName = `workspace-${context.newAppInsightsName}`
        return l10n.t('Failed to create log analytics workspace "{0}".', workspaceName);
    }
    protected getOutputLogProgress(context: IAppServiceWizardContext): string {
        const workspaceName = `workspace-${context.newAppInsightsName}`
        return l10n.t('Creating log analytics workspace "{0}"...', workspaceName);
    }

    public async execute(context: IAppServiceWizardContext, _progress: Progress<{ message?: string | undefined; increment?: number | undefined }>): Promise<void> {
        const opClient = await createOperationalInsightsManagementClient(context);
        const rgName = nonNullValueAndProp(context.resourceGroup, 'name');
        const resourceLocation: AzExtLocation = await LocationListStep.getLocation(context);
        const location = await getAppInsightsSupportedLocation(context, resourceLocation);

        if (!location) {
            // if there is no supported AI location, then skip this as AppInsightsCreateStep will be skipped
            this._skippedCreate = true;
            return;
        }

        const workspaces = await uiUtils.listAllIterator(opClient.workspaces.list());
        const workspacesInSameLoc = workspaces.filter(ws => ws.location === location);
        const workspacesInSameRg = workspacesInSameLoc.filter(ws => getResourceGroupFromId(nonNullProp(ws, 'id')) === rgName);

        context.logAnalyticsWorkspace = workspacesInSameRg[0] ?? workspacesInSameLoc[0];

        if (context.logAnalyticsWorkspace) {
            this._usedExistingLaw = true;
        } else {
            const workspaceName = `workspace-${context.newAppInsightsName}`
            context.logAnalyticsWorkspace = await opClient.workspaces.beginCreateOrUpdateAndWait(rgName, workspaceName, { location });
        }
    }

    public shouldExecute(context: IAppServiceWizardContext): boolean {
        return !context.logAnalyticsWorkspace;
    }
}
