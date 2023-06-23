/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, ExecuteActivityContext, IActionContext, createSubscriptionContext, isAzExtTreeItem } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { LinkerItem } from "../createLinker/createLinker";
import { IPickLinkerContext } from "../deleteLinker/IPickLinkerContext";
import { LinkerListStep } from "../deleteLinker/LinkerListStep";
import { ValidateLinkerStep } from "./ValidateLinkerStep";

export async function validateLinker(context: IActionContext & ExecuteActivityContext, item: LinkerItem | AzExtTreeItem, preSteps: AzureWizardPromptStep<IPickLinkerContext>[] = []): Promise<void> {
    const subscription = isAzExtTreeItem(item) ? item.subscription : createSubscriptionContext(item.subscription);

    const wizardContext: IPickLinkerContext = {
        ...context,
        ...subscription,
        sourceResourceUri: item?.id,
    }

    const promptSteps: AzureWizardPromptStep<IPickLinkerContext>[] = [
        new LinkerListStep()
    ];

    preSteps.forEach(step => promptSteps.unshift(step));

    const executeSteps: AzureWizardExecuteStep<IPickLinkerContext>[] = [
        new ValidateLinkerStep()
    ];

    const wizard: AzureWizard<IPickLinkerContext> = new AzureWizard(wizardContext, {
        title: vscode.l10n.t('Validate service connector'),
        promptSteps,
        executeSteps
    });

    await wizard.prompt();
    await wizard.execute();
}
