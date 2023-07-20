/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, DeleteConfirmationStep, ExecuteActivityContext, IActionContext, ISubscriptionContext, createSubscriptionContext } from "@microsoft/vscode-azext-utils";
import { AzureSubscription } from "@microsoft/vscode-azureresources-api";
import * as vscode from 'vscode';
import { isAzureSubscription } from "../createLinker/createLinker";
import { DeleteLinkerStep } from "./DeleteLinkerStep";
import { IPickLinkerContext } from "./IPickLinkerContext";
import { LinkerListStep } from "./LinkerListStep";

export async function deleteLinker(context: IActionContext & ExecuteActivityContext, id: string, subscription: ISubscriptionContext | AzureSubscription, serviceConnectorName?: string, preSteps: AzureWizardPromptStep<IPickLinkerContext>[] = []): Promise<void> {
    subscription = isAzureSubscription(subscription) ? createSubscriptionContext(subscription) : subscription; // For v1.5 compatibility

    const wizardContext: IPickLinkerContext = {
        ...context,
        ...subscription,
        sourceResourceUri: id,
    }

    const confirmMessage: string = vscode.l10n.t('Are you sure you want to delete this service connector? This action will delete the service connection but not the service.');

    const promptSteps: AzureWizardPromptStep<IPickLinkerContext>[] = [
        new LinkerListStep(),
        new DeleteConfirmationStep(confirmMessage)
    ];

    if (serviceConnectorName) {
        wizardContext.linkerName = serviceConnectorName;
    }

    preSteps.forEach(step => promptSteps.unshift(step));

    const executeSteps: AzureWizardExecuteStep<IPickLinkerContext>[] = [
        new DeleteLinkerStep()
    ];

    const wizard: AzureWizard<IPickLinkerContext> = new AzureWizard(wizardContext, {
        title: vscode.l10n.t('Delete service connector'),
        promptSteps,
        executeSteps
    });

    await wizard.prompt();
    await wizard.execute();
}
