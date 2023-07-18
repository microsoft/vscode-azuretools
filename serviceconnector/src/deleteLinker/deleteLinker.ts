/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, DeleteConfirmationStep, ExecuteActivityContext, IActionContext, createSubscriptionContext, isAzExtTreeItem } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { LinkerItem } from "../createLinker/createLinker";
import { DeleteLinkerStep } from "./DeleteLinkerStep";
import { IPickLinkerContext } from "./IPickLinkerContext";
import { LinkerListStep } from "./LinkerListStep";

export async function deleteLinker(context: IActionContext & ExecuteActivityContext, item: LinkerItem | AzExtTreeItem, preSteps: AzureWizardPromptStep<IPickLinkerContext>[] = []): Promise<void> {
    const subscription = isAzExtTreeItem(item) ? item.subscription : createSubscriptionContext(item.subscription); // For v1.5 compatibility

    const wizardContext: IPickLinkerContext = {
        ...context,
        ...subscription,
        sourceResourceUri: item?.id,
    }

    const confirmMessage: string = vscode.l10n.t('Are you sure you want to delete this service connector? This action will delete the service connection but not the service.');

    const promptSteps: AzureWizardPromptStep<IPickLinkerContext>[] = [
        new LinkerListStep(),
        new DeleteConfirmationStep(confirmMessage)
    ];

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
