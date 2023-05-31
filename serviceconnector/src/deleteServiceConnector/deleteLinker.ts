/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, IActionContext, createSubscriptionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { LinkerItem } from "../createServiceConnector/createLinker";
import { DeleteLinkerStep } from "./DeleteLinkerStep";
import { IPickLinkerContext } from "./IPickLinkerContext";
import { LinkerListStep } from "./LinkerListStep";

export async function deleteLinker(context: IActionContext, item: LinkerItem | AzExtTreeItem): Promise<void> {
    const subscription = item instanceof AzExtTreeItem ? item.subscription : createSubscriptionContext(item.subscription);

    const wizardContext: IPickLinkerContext = {
        ...context,
        ...subscription,
        sourceResourceUri: item?.id,
    }

    const title: string = vscode.l10n.t('Delete service connector');

    const promptSteps: AzureWizardPromptStep<IPickLinkerContext>[] = [
        new LinkerListStep()
    ];

    const executeSteps: AzureWizardExecuteStep<IPickLinkerContext>[] = [
        new DeleteLinkerStep()
    ];

    const wizard: AzureWizard<IPickLinkerContext> = new AzureWizard(wizardContext, {
        title,
        promptSteps,
        executeSteps
    });

    await wizard.prompt();
    await wizard.execute();
}
