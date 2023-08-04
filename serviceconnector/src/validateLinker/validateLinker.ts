/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, ExecuteActivityContext, IActionContext, ISubscriptionContext, createSubscriptionContext } from "@microsoft/vscode-azext-utils";
import { AzureSubscription } from "@microsoft/vscode-azureresources-api";
import * as vscode from 'vscode';
import { isAzureSubscription } from "../createLinker/createLinker";
import { IPickLinkerContext } from "../deleteLinker/IPickLinkerContext";
import { LinkerListStep } from "../deleteLinker/LinkerListStep";
import { ValidateLinkerStep } from "./ValidateLinkerStep";

export async function validateLinker(context: IActionContext & ExecuteActivityContext, id: string, subscription: ISubscriptionContext | AzureSubscription, serviceConnectorName?: string, preSteps: AzureWizardPromptStep<IPickLinkerContext>[] = []): Promise<void> {
    subscription = isAzureSubscription(subscription) ? createSubscriptionContext(subscription) : subscription; // For v1.5 compatibility

    const wizardContext: IPickLinkerContext = {
        ...context,
        ...subscription,
        sourceResourceUri: id,
    }

    const promptSteps: AzureWizardPromptStep<IPickLinkerContext>[] = [
        new LinkerListStep()
    ];

    wizardContext.linkerName = serviceConnectorName;

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
